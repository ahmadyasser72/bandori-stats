import { AbortTaskRunError, schemaTask, tags } from "@trigger.dev/sdk";
import {
	bold,
	ChannelType,
	Client,
	DiscordAPIError,
	EmbedBuilder,
	spoiler,
	subtext,
	time,
	TimestampStyles,
	WebhookClient,
	type MessageCreateOptions,
} from "discord.js";
import { allKeyed, chunk, curry } from "es-toolkit";
import z from "zod";

import dayjs from "@bandori-stats/bestdori/date";
import { formatNumber, stripBB } from "@bandori-stats/bestdori/helpers";
import { GameEventType } from "@bandori-stats/bestdori/schema/misc";
import { db } from "@bandori-stats/database";
import { GBP, redis } from "@bandori-stats/database/redis";
import { type TrackerSnapshot } from "@bandori-stats/database/schema";
import {
	getTrackingReference,
	TrackingReference,
	TrackingTarget,
} from "@bandori-stats/database/tracker";
import { useDiscordBot } from "~/discord";

export const discordTracker = schemaTask({
	id: "discord-tracker",
	schema: z.object({
		metadatas: z
			.array(
				z
					.discriminatedUnion("kind", [
						z.object({
							kind: z.literal("event"),
							type: GameEventType,
							musics: z.array(z.object({ id: z.number(), title: z.string() })),
						}),
						z.object({ kind: z.literal("monthly") }),
					])
					.and(z.object({ id: z.number(), name: z.string() })),
			)
			.nonempty(),
	}),
	run: async ({ metadatas }, { ctx }) => {
		const now = dayjs.tz(ctx.run.startedAt).startOf("hour");

		await useDiscordBot(async ({ client, guild }) => {
			await guild.channels.fetch();

			const anHourAgo = now.subtract(1, "hour");
			const yesterday = now.subtract(1, "day");
			const isDaily = now.get("hour") === 0;
			const items = await Promise.all(
				metadatas.map((metadata) => {
					const trackingReference = getTrackingReference(metadata);
					return allKeyed({
						hourly: getSnapshots(trackingReference, { now, since: anHourAgo }),
						daily: isDaily
							? getSnapshots(trackingReference, { now, since: yesterday })
							: [],

						thread: getThread(client, metadata, "discord-thread"),
						webhook: (async () => {
							const key = GBP.fromMetadata(metadata, "discord-webhook");
							const urls = await redis().smembers(key);
							return { key, urls };
						})(),

						music: (() => {
							if (metadata.kind !== "event" || metadata.musics.length === 0)
								return;

							const musics = [] as typeof metadata.musics;
							if (metadata.type === "medley")
								musics.push({
									id: metadata.musics[0].id,
									title: metadata.musics.map(({ title }) => title).join(" / "),
								});
							else musics.push(...metadata.musics);

							return allKeyed({
								hourly: Promise.all(
									musics.map(async ({ id, title }) => ({
										title,
										snapshots: await getSnapshots(
											{ trackingFor: "music", trackingId: id },
											{ now, since: anHourAgo },
										).then((snapshots) =>
											snapshots.filter(
												({ current, previous, delta, lastPlayed }) =>
													(now.diff(lastPlayed, "hour") < 1 &&
														(delta.point > 0 || !previous)) ||
													(now.diff(current.timestamp, "hour") < 1 &&
														delta.rank !== 0),
											),
										),
									})),
								).then((musics) =>
									musics.filter(({ snapshots }) => snapshots.length > 0),
								),
								daily: isDaily
									? Promise.all(
											musics.map(async ({ id, title }) => ({
												title,
												snapshots: await getSnapshots(
													{ trackingFor: "music", trackingId: id },
													{ now, since: yesterday },
												),
											})),
										).then((musics) =>
											musics.filter(({ snapshots }) => snapshots.length > 0),
										)
									: [],

								thread: getThread(
									client,
									metadata,
									"discord-thread-musics",
								).catch(() => null),
							});
						})(),

						metadata,
					});
				}),
			);

			const results = await Promise.allSettled(
				items.map(
					async ({ hourly, daily, thread, webhook, music, metadata }) => {
						const options = { now, footer: metadata.name };
						await Promise.all([
							(async () => {
								const sendWebhooks = (payload: MessageCreateOptions) =>
									Promise.all(
										webhook.urls.map((url) =>
											new WebhookClient({ url })
												.send({
													...payload,
													username: client.user?.username,
													avatarURL: client.user?.avatarURL() ?? undefined,
												})
												.catch((error) => {
													if (
														error instanceof DiscordAPIError &&
														error.status === 404
													)
														return redis().srem(webhook.key, `"${url}"`);

													throw error;
												}),
										),
									);

								if (hourly.length > 0) {
									const embed = generateEmbed(hourly, {
										title: "Hourly Tracker",
										since: anHourAgo,
										...options,
									});

									await Promise.all([
										thread.send({ embeds: [embed] }),
										sendWebhooks({ embeds: [embed] }),
									]);
								}

								if (daily.length > 0) {
									const embed = generateEmbed(daily, {
										title: "Daily Tracker",
										since: yesterday,
										...options,
									});

									await Promise.all([
										thread
											.send({ embeds: [embed] })
											.then((message) => message.pin()),
										sendWebhooks({ embeds: [embed] }),
									]);
								}
							})(),
							music &&
								(async () => {
									const { hourly, daily, thread } = music;
									if (!thread) return;

									if (hourly.length > 0) {
										const embeds = hourly.map(({ title, snapshots }) =>
											generateEmbed(snapshots, {
												title: `🎵 ${title} — Hourly`,
												since: anHourAgo,
												...options,
											}),
										);

										await thread.send({ embeds });
									}

									if (daily.length > 0) {
										const embeds = daily.map(({ title, snapshots }) =>
											generateEmbed(snapshots, {
												title: `🎵 ${title} — Daily`,
												since: yesterday,
												...options,
											}),
										);

										await thread
											.send({ embeds })
											.then((message) => message.pin());
									}
								})(),
						]);
					},
				),
			);

			const errors = results.filter((promise) => promise.status === "rejected");
			for (const { reason } of errors) console.error(reason);
			if (errors.length > 0) await tags.add("error_settled");
		});
	},
});

interface GetSnapshotsOptions {
	since: dayjs.Dayjs;
	now: dayjs.Dayjs;
}

export const getSnapshots = async (
	trackingReference: TrackingReference,
	{ since, now }: GetSnapshotsOptions,
) => {
	const getRankAt = curry((reference: dayjs.Dayjs, rank: number) =>
		db().query.trackerSnapshots.findFirst({
			where: {
				...trackingReference,
				rank,
				timestamp: { lte: reference.toDate() },
			},
			orderBy: { id: "desc" },
		}),
	);

	const getLatestRank = getRankAt(now);
	const getPreviousRank = getRankAt(since);
	const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
	const [top10, previousTop10] = chunk(
		await db().batch([
			...ranks.map(getLatestRank),
			...ranks.map(getPreviousRank),
		] as [ReturnType<typeof getLatestRank>]),
		10,
	).map((top10) => top10.filter((it) => it !== undefined));
	if (top10.length === 0) return [];

	const getBefore = ({ id, uid }: TrackerSnapshot) =>
		db().query.trackerSnapshots.findFirst({
			columns: { point: true, rank: true, timestamp: true },
			where: {
				...trackingReference,
				uid,
				id: { lt: id },
				timestamp: { lte: since.toDate() },
			},
			orderBy: { id: "desc" },
		});
	const getWindowStart = ({ id, uid }: TrackerSnapshot) =>
		db().query.trackerSnapshots.findFirst({
			columns: { point: true, rank: true, timestamp: true },
			where: {
				...trackingReference,
				uid,
				id: { lt: id },
				timestamp: { gt: since.toDate(), lt: now.toDate() },
			},
			orderBy: { id: "asc" },
		});
	const getLastPlayed = ({ id, uid, point }: TrackerSnapshot) =>
		db().query.trackerSnapshots.findFirst({
			columns: { point: true, rank: true, timestamp: true },
			where: {
				...trackingReference,
				uid,
				id: { lte: id },
				point,
			},
			orderBy: { id: "asc" },
		});

	type Output = ReturnType<typeof getBefore>;
	const snapshots = chunk(
		await db().batch(
			top10.flatMap((it) => [
				getBefore(it),
				getWindowStart(it),
				getLastPlayed(it),
			]) as [Output, ...Output[]],
		),
		3,
	);

	const periodDuration = now.diff(since);
	const formerTop10 = new Set(previousTop10.map(({ uid }) => uid));
	const useStale = trackingReference.trackingFor !== "music";
	return top10.map((current, idx) => {
		const [beforePeriod, windowStart, lastPlayed = current] = snapshots[idx];
		const stale =
			useStale &&
			(!beforePeriod || now.diff(lastPlayed.timestamp) > periodDuration);
		const returning = beforePeriod && !formerTop10.has(current.uid);
		const baseline = stale ? windowStart : beforePeriod;

		return {
			current,
			previous: baseline ?? beforePeriod,
			returning,
			lastPlayed: lastPlayed.timestamp,
			delta:
				baseline && (!returning || !useStale)
					? {
							point: current.point - baseline.point,
							rank: current.rank - baseline.rank,
						}
					: { point: 0, rank: 0 },
		};
	});
};

interface GenerateEmbedOptions extends GetSnapshotsOptions {
	footer: string;
	title: string;
}

const generateEmbed = (
	snapshots: Awaited<ReturnType<typeof getSnapshots>>,
	{ footer, title, since, now }: GenerateEmbedOptions,
) => {
	const embed = new EmbedBuilder()
		.setTitle(title)
		.setDescription(
			[since, now]
				.map((date) => time(date.toDate(), TimestampStyles.ShortDateShortTime))
				.join(" — "),
		)
		.setColor(0x55ddee)
		.setFooter({ text: footer })
		.setTimestamp(now.toDate());

	for (const { current, previous, returning, lastPlayed, delta } of snapshots) {
		let points = `${formatNumber(current.point)} Pts`;
		if (delta.point > 0)
			points += ` (${formatNumber(delta.point, { positiveSign: true })} Pts)`;

		embed.addFields({
			name: [bold(`#${current.rank} ${stripBB(current.name)}`), points].join(
				" — ",
			),
			value: (() => {
				const lines = [] as string[];

				{
					let status = "";
					if (returning) status = "🔙";
					else if (!previous) status = "🆕";

					if (status) lines.push(`#${current.rank} ${status}`);
				}

				if (delta.rank !== 0) {
					const difference = Math.abs(delta.rank);
					const arrow = delta.rank > 0 ? "⬇️" : "⬆️";
					lines.push(
						`#${previous!.rank} → #${current.rank} ${arrow.repeat(difference)}`,
					);
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
	{ kind, id }: TrackingTarget,
	keySuffix: string,
) => {
	const forumId = process.env[`DISCORD_${kind.toUpperCase()}_TRACKER_FORUM_ID`];
	if (!forumId)
		throw new AbortTaskRunError(`${kind} tracker forum id is not defined.`);

	const forum = client.channels.cache.find(({ id }) => id === forumId);
	if (!forum || forum.type !== ChannelType.GuildForum)
		throw new AbortTaskRunError(`${kind} tracker forum doesn't exists.`);

	const key = GBP.fromMetadata({ kind, id }, keySuffix);
	const threadId = await redis().get<number>(key);
	if (!threadId)
		throw new AbortTaskRunError(`${kind}:${id} thread doesn't exists.`);

	const thread = await forum.threads.fetch(threadId.toString());
	if (!thread)
		throw new AbortTaskRunError(`${kind}:${id} thread doesn't exists.`);

	return thread;
};
