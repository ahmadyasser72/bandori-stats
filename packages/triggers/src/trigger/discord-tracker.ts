import { AbortTaskRunError, schemaTask, wait } from "@trigger.dev/sdk";
import {
	bold,
	ChannelType,
	Client,
	ContainerBuilder,
	heading,
	MessageFlags,
	SeparatorBuilder,
	SeparatorSpacingSize,
	subtext,
	TextDisplayBuilder,
	ThreadAutoArchiveDuration,
	time,
	TimestampStyles,
	type MessageCreateOptions,
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

			for (const { hourly, daily, thread } of items) {
				if (daily.length > 0) {
					const payload = generatePayload(daily);
					const timestamp = [yesterday, now]
						.map((date) =>
							time(date.toDate(), TimestampStyles.ShortDateShortTime),
						)
						.join(" — ");
					await thread
						.send({
							...payload,
							content: heading(`Daily tracker -> ${timestamp}`),
						})
						.then((message) => message.pin());
				}

				if (hourly.length > 0) {
					const payload = generatePayload(hourly);
					const timestamp = [anHourAgo, now]
						.map((date) =>
							time(date.toDate(), TimestampStyles.ShortDateShortTime),
						)
						.join(" — ");
					await thread.send({
						...payload,
						content: heading(`Hourly tracker -> ${timestamp}`),
					});
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

const generatePayload = (
	snapshots: Awaited<ReturnType<typeof getSnapshots>>,
) => {
	const components = snapshots.map(({ current, previous, lastPlayed }, idx) => {
		const components = [] as (TextDisplayBuilder | SeparatorBuilder)[];
		if (idx > 0) {
			components.push(
				new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
			);
		}

		const lines: string[] = [
			bold(`#${current.rank} ${stripBB(current.name)}`) +
				` ‒ ${formatNumber(current.point)} Pts`,
		];
		if (previous) {
			const pointsDelta = current.point - previous.point;
			if (pointsDelta > 0) {
				lines[0] += ` (${formatNumber(pointsDelta, { positiveSign: true })} Pts)`;
			}

			if (current.rank !== previous.rank) {
				lines.push(`Rank #${previous.rank} -> #${current.rank}`);
			}
		}

		lines.push(
			subtext(
				`played ||${time(lastPlayed, TimestampStyles.RelativeTime)} @ ${time(lastPlayed, TimestampStyles.ShortDateShortTime)}||`,
			),
		);

		components.push(new TextDisplayBuilder().setContent(lines.join("\n")));
		return components.map((component) => component.toJSON());
	});

	return {
		components: [new ContainerBuilder({ components: components.flat() })],
		flags: MessageFlags.IsComponentsV2,
	} satisfies MessageCreateOptions;
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
