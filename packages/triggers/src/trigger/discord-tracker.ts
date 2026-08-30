import { AbortTaskRunError, tags, task, wait } from "@trigger.dev/sdk";
import {
	ChannelType,
	Client,
	EmbedBuilder,
	ThreadAutoArchiveDuration,
	type APIEmbedField,
	type PublicThreadChannel,
} from "discord.js";
import { allKeyed } from "es-toolkit";
import type z from "zod";

import dayjs from "@bandori-stats/bestdori/date";
import { formatNumber, stripBB } from "@bandori-stats/bestdori/helpers";
import type {
	GameEvent,
	GameMonthlyRanking,
} from "@bandori-stats/bestdori/schema/misc";
import { db } from "@bandori-stats/database";
import {
	GBP,
	getRedisKey,
	getTrackingReference,
	redis,
} from "@bandori-stats/database/redis";
import type { GbpMetadata } from "@bandori-stats/database/schema";

export const discordTracker = task({
	id: "discord-tracker",
	run: async (_, { ctx }) => {
		const now = dayjs(ctx.attempt.startedAt).endOf("hour");

		const [event, monthly] = await redis().mget<
			[
				z.infer<typeof GameEvent> | null,
				z.infer<typeof GameMonthlyRanking> | null,
			]
		>(GBP.event.current, GBP.monthly.current);

		await tags.add([
			`event_${event?.assetBundleName ?? "n/a"}`,
			`monthly_${monthly?.assetBundleName ?? "n/a"}`,
		]);

		const metadatas = [] as GbpMetadata[];
		if (event)
			metadatas.push({ kind: "event", ...event } as unknown as GbpMetadata);
		if (monthly)
			metadatas.push({ kind: "monthly", ...monthly } as unknown as GbpMetadata);
		if (metadatas.length === 0) return;

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

			const items = await Promise.all(
				metadatas.map((metadata) =>
					allKeyed({
						embeds: getSnapshots(now, metadata).then(generateEmbeds),
						thread: getThread(client, metadata),
					}),
				),
			);

			for (const { embeds, thread } of items) await thread.send({ embeds });
		} finally {
			await client.destroy();
		}
	},
});

const getSnapshots = async (now: dayjs.Dayjs, metadata: GbpMetadata) => {
	const key = getRedisKey(metadata);
	const top10 = await redis()
		.zrange<number[]>(`${key}:leaderboard`, 0, 9, { rev: true })
		.then((uids) => uids.map((uid) => uid.toString()));

	const trackingReference = getTrackingReference(metadata);
	const anHourAgo = now.subtract(1, "hour").toDate();
	const getLastHour = (uid: string) =>
		db().query.trackerSnapshots.findMany({
			columns: { name: true, point: true, rank: true, timestamp: true },
			where: {
				...trackingReference,
				uid,
				timestamp: { lte: now.toDate(), gte: anHourAgo },
			},
			orderBy: { id: "asc" },
		});
	const getAnHourAgo = (uid: string) =>
		db().query.trackerSnapshots.findFirst({
			columns: { name: true, point: true, rank: true, timestamp: true },
			where: { ...trackingReference, uid, timestamp: { lte: anHourAgo } },
			orderBy: { id: "desc" },
		});

	const snapshots = await db().batch([
		getLastHour(top10[0]),
		getAnHourAgo(top10[0]),
		...top10.slice(1).flatMap((uid) => [getLastHour(uid), getAnHourAgo(uid)]),
	]);

	return top10.map((_, idx) => {
		const lastHour = snapshots[2 * idx] as Awaited<
			ReturnType<typeof getLastHour>
		>;
		const previous = snapshots[2 * idx + 1] as Awaited<
			ReturnType<typeof getAnHourAgo>
		>;

		return {
			count: lastHour.filter(
				({ point }, idx) =>
					point !== (idx === 0 ? previous?.point : lastHour[idx - 1].point),
			).length,
			current: lastHour.at(-1) ?? previous!,
			previous: previous,
		};
	});
};

const generateEmbeds = (snapshots: Awaited<ReturnType<typeof getSnapshots>>) =>
	snapshots.map(({ current, previous, count }) => {
		const embed = new EmbedBuilder()
			.setAuthor({
				name: `#${current.rank} ${stripBB(current.name)} - ${formatNumber(current.point)} Pts`,
			})
			.setTimestamp(current.timestamp);

		const fields = [] as APIEmbedField[];
		if (previous) {
			const pointsDelta = current.point - previous.point;
			if (pointsDelta > 0) {
				fields.push({
					name: "Games",
					value: `${count}× (${formatNumber(pointsDelta, { positiveSign: true })} Pts)`,
					inline: true,
				});
			}

			if (current.rank !== previous.rank) {
				fields.push({
					name: "Rank",
					value: `#${previous.rank} -> #${current.rank}`,
					inline: true,
				});
			}
		}

		if (fields.length > 0) embed.addFields(fields);
		return embed;
	});

const getThread = async (client: Client, metadata: GbpMetadata) => {
	const key = getRedisKey(metadata) + ":discord";
	const fromRedis = await redis().get<number>(key);
	if (fromRedis) {
		const maybeThread = await client.channels.fetch(fromRedis.toString());
		if (maybeThread && maybeThread.type === ChannelType.PublicThread)
			return maybeThread;
	}

	const mainChannelName = `${metadata.kind}-tracker`;
	const mainChannel = client.channels.cache.find(
		(channel) =>
			channel.type === ChannelType.GuildText &&
			channel.name === mainChannelName,
	);
	if (!mainChannel || mainChannel.type !== ChannelType.GuildText)
		throw new AbortTaskRunError(`${mainChannelName} channel doesn't exists.`);

	const id =
		metadata.kind === "event" ? metadata.eventId : metadata.monthlyRankingId;
	const name =
		metadata.kind === "event"
			? metadata.eventName
			: metadata.monthlyRankingName;
	const thread = await mainChannel.threads.create({
		name: `#${id} ${name}`,
		autoArchiveDuration: ThreadAutoArchiveDuration.ThreeDays,
		type: ChannelType.PublicThread,
	});

	await redis().set(key, thread.id);
	return thread as PublicThreadChannel;
};
