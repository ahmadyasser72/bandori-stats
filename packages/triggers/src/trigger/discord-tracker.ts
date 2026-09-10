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
import { allKeyed, chunk } from "es-toolkit";
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
	const getLatestRank = (rank: number) =>
		db().query.trackerSnapshots.findFirst({
			where: { ...trackingReference, rank, timestamp: { lte: now.toDate() } },
			orderBy: { id: "desc" },
		});

	const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
	const top10 = (
		await db().batch([getLatestRank(1), ...ranks.slice(1).map(getLatestRank)])
	).filter((it) => it !== undefined);
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
	const getInPeriod = ({ id, uid }: TrackerSnapshot) =>
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
	const getPrevious = ({ id, uid, point }: TrackerSnapshot) =>
		db().query.trackerSnapshots.findFirst({
			columns: { point: true, rank: true, timestamp: true },
			where: {
				...trackingReference,
				uid,
				id: { lt: id },
				point: { ne: point },
			},
			orderBy: { id: "desc" },
		});
	const snapshots = chunk(
		await db().batch([
			getBefore(top10[0]),
			getInPeriod(top10[0]),
			getPrevious(top10[0]),
			...top10
				.slice(1)
				.flatMap((it) => [getBefore(it), getInPeriod(it), getPrevious(it)]),
		]),
		3,
	);

	return top10.map((current, idx) => {
		const [beforePeriod, inPeriod, previous] = snapshots[idx];
		const lastPlayed =
			previous && previous.point === current.point ? previous : current;

		let pointReference = beforePeriod;
		if (beforePeriod && since.diff(beforePeriod.timestamp) > now.diff(since))
			pointReference = inPeriod;

		return {
			current,
			previous: beforePeriod,
			lastPlayed: lastPlayed.timestamp,
			delta: {
				point: pointReference ? current.point - pointReference.point : 0,
				rank: beforePeriod ? current.rank - beforePeriod.rank : 0,
			},
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

	for (const { current, previous, lastPlayed, delta } of snapshots) {
		let points = `${formatNumber(current.point)} Pts`;
		if (delta.point > 0)
			points += ` (${formatNumber(delta.point, { positiveSign: true })} Pts)`;
		if (!previous) points += " 🆕";

		embed.addFields({
			name: [bold(`#${current.rank} ${stripBB(current.name)}`), points].join(
				" — ",
			),
			value: (() => {
				const lines = [] as string[];

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
