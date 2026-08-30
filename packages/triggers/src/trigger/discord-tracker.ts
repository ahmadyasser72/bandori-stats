import { AbortTaskRunError, tags, task, wait } from "@trigger.dev/sdk";
import {
	bold,
	ChannelType,
	Client,
	MessageFlags,
	SeparatorBuilder,
	SeparatorSpacingSize,
	subtext,
	TextDisplayBuilder,
	ThreadAutoArchiveDuration,
	time,
	TimestampStyles,
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
		const now = dayjs(ctx.attempt.startedAt).startOf("hour").add(1, "hour");

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
						payload: getSnapshots(now, metadata).then(generatePayloads),
						thread: getThread(client, metadata),
					}),
				),
			);

			for (const { payload, thread } of items)
				await thread.send({ ...payload, flags: MessageFlags.IsComponentsV2 });
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
	const getCurrent = (uid: string) =>
		db().query.trackerSnapshots.findFirst({
			columns: { id: false },
			where: { ...trackingReference, uid, timestamp: { lte: now.toDate() } },
			orderBy: { id: "desc" },
		});
	const anHourAgo = now.subtract(1, "hour").toDate();
	const getAnHourAgo = (uid: string) =>
		db().query.trackerSnapshots.findFirst({
			columns: { name: true, point: true, rank: true, timestamp: true },
			where: { ...trackingReference, uid, timestamp: { lte: anHourAgo } },
			orderBy: { id: "desc" },
		});

	const snapshots = await db().batch([
		getCurrent(top10[0]),
		getAnHourAgo(top10[0]),
		...top10.slice(1).flatMap((uid) => [getCurrent(uid), getAnHourAgo(uid)]),
	]);

	return top10.map((_, idx) => ({
		current: (snapshots[2 * idx] as Awaited<ReturnType<typeof getCurrent>>)!,
		previous: snapshots[2 * idx + 1] as Awaited<
			ReturnType<typeof getAnHourAgo>
		>,
	}));
};

const generatePayloads = async (
	snapshots: Awaited<ReturnType<typeof getSnapshots>>,
) =>
	allKeyed({
		components: Promise.all(
			snapshots.map(async ({ current, previous }, idx) => {
				const components = [] as (TextDisplayBuilder | SeparatorBuilder)[];

				if (idx > 0)
					components.push(
						new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
					);

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

				let lastPlayed = current.timestamp;
				if (
					previous &&
					current.point === previous.point &&
					current.timestamp.valueOf() !== previous.timestamp.valueOf()
				) {
					const snapshot = await db().query.trackerSnapshots.findFirst({
						columns: { timestamp: true },
						where: {
							trackingFor: current.trackingFor,
							trackingId: current.trackingId,
							uid: current.uid,
							point: current.point,
						},
						orderBy: { id: "asc" },
					});

					if (snapshot) lastPlayed = snapshot.timestamp;
				}

				lines.push(
					subtext(
						`played ||${time(lastPlayed, TimestampStyles.RelativeTime)} @ ${time(lastPlayed, TimestampStyles.ShortDate)} ${time(lastPlayed, TimestampStyles.ShortTime)}||`,
					),
				);
				components.push(new TextDisplayBuilder({ content: lines.join("\n") }));

				return components;
			}),
		).then((components) => components.flat()),
	});

const getThread = async (client: Client, metadata: GbpMetadata) => {
	const mainChannelName = `${metadata.kind}-tracker`;
	const mainChannel = client.channels.cache.find(
		(channel) =>
			channel.type === ChannelType.GuildText &&
			channel.name === mainChannelName,
	);
	if (!mainChannel || mainChannel.type !== ChannelType.GuildText)
		throw new AbortTaskRunError(`${mainChannelName} channel doesn't exists.`);

	const key = getRedisKey(metadata) + ":discord";
	const fromRedis = await redis().get<number>(key);
	if (fromRedis) {
		const thread = await mainChannel.threads.fetch(fromRedis.toString());
		if (thread && thread.type === ChannelType.PublicThread) return thread;
	}

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
