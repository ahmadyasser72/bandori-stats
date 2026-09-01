import { AbortTaskRunError, schemaTask, wait } from "@trigger.dev/sdk";
import {
	bold,
	ChannelType,
	Client,
	EmbedBuilder,
	spoiler,
	subtext,
	ThreadAutoArchiveDuration,
	time,
	TimestampStyles,
	type PublicThreadChannel,
} from "discord.js";
import { allKeyed } from "es-toolkit";
import z from "zod";

import { GBP_TIMEZONE } from "@bandori-stats/bestdori/constants";
import dayjs from "@bandori-stats/bestdori/date";
import { formatNumber, stripBB } from "@bandori-stats/bestdori/helpers";
import { db } from "@bandori-stats/database";
import { GBP, redis } from "@bandori-stats/database/redis";
import type { GbpMetadata } from "@bandori-stats/database/schema";
import { getTrackingReference } from "@bandori-stats/database/tracker";

export const discordTracker = schemaTask({
	id: "discord-tracker",
	schema: z.object({
		metadatas: z
			.array(
				z.object({
					kind: z.enum(["event", "monthly"]),
					id: z.number(),
					name: z.string(),
				}),
			)
			.nonempty(),
	}),
	run: async ({ metadatas }, { ctx }) => {
		const now = dayjs
			.tz(ctx.attempt.startedAt, GBP_TIMEZONE)
			.startOf("hour")
			.add(1, "hour");

		const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID } = process.env;
		if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID)
			throw new AbortTaskRunError("Discord credentials are missing.");

		await wait.until({ date: now.toDate() });

		const client = new Client({ intents: [] });
		try {
			await client.login(DISCORD_BOT_TOKEN);
			await client.guilds
				.fetch(DISCORD_GUILD_ID)
				.then((guild) => guild.channels.fetch());

			const anHourAgo = now.subtract(1, "hour");
			const yesterday = now.subtract(1, "day");
			const items = await Promise.all(
				metadatas.map((metadata) =>
					allKeyed({
						hourly: getSnapshots(metadata, { now, since: anHourAgo }),
						daily:
							now.get("hour") === 0
								? getSnapshots(metadata, { now, since: yesterday })
								: [],

						thread: getThread(client, metadata),
					}),
				),
			);

			const formatTimestamp = (since: dayjs.Dayjs) =>
				[since, now]
					.map((date) =>
						time(date.toDate(), TimestampStyles.ShortDateShortTime),
					)
					.join(" — ");

			for (const { hourly, daily, thread } of items) {
				if (hourly.length > 0) {
					const embed = generateEmbed(hourly)
						.setTitle("Hourly tracker")
						.setDescription(formatTimestamp(anHourAgo));

					await thread.send({ embeds: [embed] });
				}

				if (daily.length > 0) {
					const embed = generateEmbed(daily)
						.setTitle("Daily tracker")
						.setDescription(formatTimestamp(yesterday));

					await thread
						.send({ embeds: [embed] })
						.then((message) => message.pin());
				}
			}
		} finally {
			await client.destroy();
		}
	},
});

interface GetSnapshotsOptions {
	since: dayjs.Dayjs;
	now: dayjs.Dayjs;
}

const getSnapshots = async (
	metadata: Pick<GbpMetadata, "kind" | "id">,
	{ since, now }: GetSnapshotsOptions,
) => {
	const key = GBP.fromMetadata(metadata, "leaderboard");
	const top10 = await redis()
		.zrange<number[]>(key, 0, 9, { rev: true })
		.then((uids) => uids.map((uid) => uid.toString()));
	if (top10.length === 0) return [];

	const trackingReference = getTrackingReference(metadata);
	const getCurrent = (uid: string) =>
		db().query.trackerSnapshots.findFirst({
			columns: { name: true, point: true, rank: true, timestamp: true },
			where: { ...trackingReference, uid, timestamp: { lte: now.toDate() } },
			orderBy: { id: "desc" },
		});
	const getPrevious = (uid: string) =>
		db().query.trackerSnapshots.findFirst({
			columns: { name: true, point: true, rank: true, timestamp: true },
			where: { ...trackingReference, uid, timestamp: { lte: since.toDate() } },
			orderBy: { id: "desc" },
		});

	const snapshots = await db().batch([
		getCurrent(top10[0]),
		getPrevious(top10[0]),
		...top10.slice(1).flatMap((uid) => [getCurrent(uid), getPrevious(uid)]),
	]);

	return Promise.all(
		top10.map(async (uid, idx) => {
			const current = (snapshots[2 * idx] as Awaited<
				ReturnType<typeof getCurrent>
			>)!;
			const previous = snapshots[2 * idx + 1] as Awaited<
				ReturnType<typeof getPrevious>
			>;

			let lastPlayed = current.timestamp;
			if (
				previous &&
				current.point === previous.point &&
				current.timestamp.getTime() !== previous.timestamp.getTime()
			) {
				const snapshot = await db().query.trackerSnapshots.findFirst({
					columns: { timestamp: true },
					where: { ...trackingReference, uid, point: current.point },
					orderBy: { id: "asc" },
				});

				if (snapshot) lastPlayed = snapshot.timestamp;
			}

			return { current, previous, lastPlayed };
		}),
	);
};

const generateEmbed = (snapshots: Awaited<ReturnType<typeof getSnapshots>>) => {
	const embed = new EmbedBuilder().setColor(0x55ddee);
	for (const { current, previous, lastPlayed } of snapshots) {
		embed.addFields({
			name: bold(`#${current.rank} ${stripBB(current.name)}`),
			value: (() => {
				const lines = [`${formatNumber(current.point)} Pts`];
				if (previous) {
					const pointsDelta = current.point - previous.point;
					if (pointsDelta > 0) {
						lines[0] += ` (${formatNumber(pointsDelta, { positiveSign: true })} Pts)`;
					}

					if (current.rank !== previous.rank) {
						const difference = Math.abs(current.rank - previous.rank);
						const arrow = current.rank > previous.rank ? "⬇️" : "⬆️";
						lines.push(
							`#${previous.rank} -> #${current.rank} ${arrow.repeat(difference)}`,
						);
					}
				}

				const timestamp = [
					time(lastPlayed, TimestampStyles.RelativeTime),
					time(lastPlayed, TimestampStyles.ShortDateShortTime),
				].join(" @ ");
				lines.push(subtext(`last played ${spoiler(timestamp)}`));
				return lines.join("\n");
			})(),
			inline: false,
		});
	}

	return embed;
};

const getThread = async (
	client: Client,
	metadata: Pick<GbpMetadata, "kind" | "id" | "name">,
) => {
	const mainChannelName = `${metadata.kind}-tracker`;
	const mainChannel = client.channels.cache.find(
		(channel) =>
			channel.type === ChannelType.GuildText &&
			channel.name === mainChannelName,
	);
	if (!mainChannel || mainChannel.type !== ChannelType.GuildText)
		throw new AbortTaskRunError(`${mainChannelName} channel doesn't exists.`);

	const key = GBP.fromMetadata(metadata, "discord");
	const fromRedis = await redis().get<number>(key);
	if (fromRedis) {
		const thread = await mainChannel.threads.fetch(fromRedis.toString());
		if (thread && thread.type === ChannelType.PublicThread) return thread;
	}

	const thread = await mainChannel.threads.create({
		name: `#${metadata.id} ${metadata.name}`,
		autoArchiveDuration: ThreadAutoArchiveDuration.ThreeDays,
		type: ChannelType.PublicThread,
	});

	await redis().set(key, thread.id);
	return thread as PublicThreadChannel;
};
