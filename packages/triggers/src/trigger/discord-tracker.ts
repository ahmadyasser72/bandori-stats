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
import { db } from "@bandori-stats/database";
import { GBP, redis } from "@bandori-stats/database/redis";
import {
	type GbpMetadata,
	type TrackerSnapshot,
} from "@bandori-stats/database/schema";
import {
	getTrackingReference,
	TrackingTarget,
} from "@bandori-stats/database/tracker";
import { useDiscordBot } from "~/discord";

export const discordTracker = schemaTask({
	id: "discord-tracker",
	schema: z.object({
		metadatas: z
			.array(z.object({ ...TrackingTarget.shape, name: z.string() }))
			.nonempty(),
	}),
	run: async ({ metadatas }, { ctx }) => {
		const now = dayjs.tz(ctx.run.startedAt).startOf("hour");

		await useDiscordBot(async ({ client, guild }) => {
			await guild.channels.fetch();

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
						webhook: (() => {
							const key = GBP.fromMetadata(metadata, "discord-webhook");
							return allKeyed({ key, urls: redis().smembers(key) });
						})(),

						metadata,
					}),
				),
			);

			const results = await Promise.allSettled(
				items.map(async ({ hourly, daily, thread, webhook, metadata }) => {
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

					const options = { metadata, now };
					if (hourly.length > 0) {
						const payload = generatePayload(hourly, {
							title: "Hourly Tracker",
							since: anHourAgo,
							...options,
						});

						await Promise.all([thread.send(payload), sendWebhooks(payload)]);
					}

					if (daily.length > 0) {
						const payload = generatePayload(daily, {
							title: "Daily Tracker",
							since: yesterday,
							...options,
						});

						await Promise.all([
							thread.send(payload).then((message) => message.pin()),
							sendWebhooks(payload),
						]);
					}
				}),
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
	metadata: TrackingTarget,
	{ since, now }: GetSnapshotsOptions,
) => {
	const trackingReference = getTrackingReference(metadata);
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

		let reference = beforePeriod;
		if (beforePeriod && since.diff(beforePeriod.timestamp) > now.diff(since))
			reference = inPeriod;

		return {
			current,
			previous: beforePeriod,
			lastPlayed: lastPlayed.timestamp,
			delta: reference
				? {
						points: current.point - reference.point,
						rank: current.rank - reference.rank,
					}
				: { points: 0, rank: 0 },
		};
	});
};

interface GeneratePayloadOptions extends GetSnapshotsOptions {
	metadata: Pick<GbpMetadata, "name">;
	title: string;
}

const generatePayload = (
	snapshots: Awaited<ReturnType<typeof getSnapshots>>,
	{ metadata, title, since, now }: GeneratePayloadOptions,
) => {
	const embed = new EmbedBuilder()
		.setTitle(title)
		.setDescription(
			[since, now]
				.map((date) => time(date.toDate(), TimestampStyles.ShortDateShortTime))
				.join(" — "),
		)
		.setColor(0x55ddee)
		.setFooter({ text: metadata.name })
		.setTimestamp(now.toDate());

	for (const { current, previous, lastPlayed, delta } of snapshots) {
		let points = `${formatNumber(current.point)} Pts`;
		if (delta.points > 0)
			points += ` (${formatNumber(delta.points, { positiveSign: true })} Pts)`;

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

	return { embeds: [embed] } satisfies MessageCreateOptions;
};

const getThread = async (client: Client, { kind, id }: TrackingTarget) => {
	const forumId = process.env[`DISCORD_${kind.toUpperCase()}_TRACKER_FORUM_ID`];
	if (!forumId)
		throw new AbortTaskRunError(`${kind} tracker forum id is not defined.`);

	const forum = client.channels.cache.find(({ id }) => id === forumId);
	if (!forum || forum.type !== ChannelType.GuildForum)
		throw new AbortTaskRunError(`${kind} tracker forum doesn't exists.`);

	const key = GBP.fromMetadata({ kind, id }, "discord-thread");
	const threadId = await redis().get<number>(key);
	if (!threadId)
		throw new AbortTaskRunError(`${kind}:${id} thread doesn't exists.`);

	const thread = await forum.threads.fetch(threadId.toString());
	if (!thread)
		throw new AbortTaskRunError(`${kind}:${id} thread doesn't exists.`);

	return thread;
};
