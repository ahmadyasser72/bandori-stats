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
import { allKeyed, pick } from "es-toolkit";
import z from "zod";

import { GBP_TIMEZONE } from "@bandori-stats/bestdori/constants";
import dayjs from "@bandori-stats/bestdori/date";
import { formatNumber, stripBB } from "@bandori-stats/bestdori/helpers";
import {
	and,
	asc,
	db,
	desc,
	eq,
	getColumns,
	gt,
	gte,
	lte,
	sql,
	sum,
} from "@bandori-stats/database";
import { GBP, redis } from "@bandori-stats/database/redis";
import {
	trackerSnapshots,
	type GbpMetadata,
} from "@bandori-stats/database/schema";

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

	const deltaSql = sql<number>`${trackerSnapshots.point} - LAG(${trackerSnapshots.point}, 1, ${trackerSnapshots.point}) OVER (ORDER BY ${asc(trackerSnapshots.id)})`;
	const gapMinutesSql = sql<number>`(${trackerSnapshots.timestamp} - LAG(${trackerSnapshots.timestamp}) OVER (ORDER BY ${asc(trackerSnapshots.id)})) / 60000.0`;
	const getSnapshot = (uid: string) => {
		const deltaCte = db()
			.$with("delta_cte")
			.as(
				db()
					.select({
						delta: deltaSql.as("delta"),
						gapMinutes: gapMinutesSql.as("gap_minutes"),
						...pick(getColumns(trackerSnapshots), [
							"id",
							"name",
							"point",
							"timestamp",
							"rank",
						]),
					})
					.from(trackerSnapshots)
					.where(
						and(
							eq(trackerSnapshots.trackingFor, metadata.kind),
							eq(trackerSnapshots.trackingId, metadata.id),
							eq(trackerSnapshots.uid, uid),
						),
					),
			);

		return [
			db()
				.with(deltaCte)
				.select({
					points: sum(
						sql`CASE WHEN ${deltaCte.gapMinutes} <= 60 THEN ${deltaCte.delta} ELSE NULL END`,
					)
						.mapWith(Number)
						.as("points"),
				})
				.from(deltaCte)
				.where(
					and(
						gte(deltaCte.timestamp, since.toDate()),
						lte(deltaCte.timestamp, now.toDate()),
					),
				),
			db()
				.with(deltaCte)
				.select({
					name: deltaCte.name,
					rank: deltaCte.rank,
					point: deltaCte.point,
				})
				.from(deltaCte)
				.where(lte(deltaCte.timestamp, now.toDate()))
				.orderBy(desc(deltaCte.id))
				.limit(1),
			db()
				.with(deltaCte)
				.select({ rank: deltaCte.rank })
				.from(deltaCte)
				.where(lte(deltaCte.timestamp, since.toDate()))
				.orderBy(desc(deltaCte.id))
				.limit(1),
			db()
				.with(deltaCte)
				.select({ lastPlayed: deltaCte.timestamp })
				.from(deltaCte)
				.where(
					and(lte(deltaCte.timestamp, now.toDate()), gt(deltaCte.delta, 0)),
				)
				.orderBy(desc(deltaCte.id))
				.limit(1),
		] as const;
	};

	const first = getSnapshot(top10[0]);
	const results = await db().batch([
		first[0],
		first[1],
		first[2],
		first[3],
		...top10.slice(1).flatMap((uid) => getSnapshot(uid)),
	]);

	return top10.map((_, idx) => {
		type Output<N extends 0 | 1 | 2 | 3> = Awaited<(typeof first)[N]>;
		const [{ points }] = results[idx * 4] as Output<0>;
		const [current] = results[idx * 4 + 1] as Output<1>;
		const [previous] = results[idx * 4 + 2] as Output<2>;
		const [{ lastPlayed }] = results[idx * 4 + 3] as Output<3>;

		return {
			current,
			previous,
			lastPlayed,
			delta: { points: points ?? 0, rank: current.rank - previous.rank },
		};
	});
};

const generateEmbed = (snapshots: Awaited<ReturnType<typeof getSnapshots>>) => {
	const embed = new EmbedBuilder().setColor(0x55ddee);
	for (const { current, previous, lastPlayed, delta } of snapshots) {
		embed.addFields({
			name: [
				bold(`#${current.rank} ${stripBB(current.name)}`),
				`${formatNumber(current.point)} Pts`,
			].join(" - "),
			value: (() => {
				const lines = [] as string[];

				const changes = [] as string[];
				{
					if (delta.rank !== 0) {
						const difference = Math.abs(delta.rank);
						const arrow = delta.rank < 0 ? "⬇️" : "⬆️";
						changes.push(
							`#${previous.rank} -> #${current.rank} ${arrow.repeat(difference)}`,
						);
					}
					if (delta.points > 0) {
						changes.push(
							`${formatNumber(delta.points, { positiveSign: true })} Pts`,
						);
					}
				}
				if (changes.length > 0) lines.push(changes.join(" | "));

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
