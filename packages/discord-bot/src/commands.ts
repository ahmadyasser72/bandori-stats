import { bold, subtext, time, TimestampStyles } from "@discordjs/formatters";
import {
	createFactory,
	makeEmbed,
	makeIntegerOption,
	makeSlashCommand,
	makeStringOption,
	type AutocompleteContext,
	type CommandContext,
} from "discord-hono";
import { capitalize } from "es-toolkit";

import dayjs from "@bandori-stats/bestdori/date";
import { formatNumber, stripBB } from "@bandori-stats/bestdori/helpers";
import { db, EmptyFilter, sql } from "@bandori-stats/database";
import { GBP, redis, type PlayerStates } from "@bandori-stats/database/redis";
import type { GbpMetadata } from "@bandori-stats/database/schema";
import {
	getTrackingMetadata,
	getTrackingReference,
	TrackingReference,
	type TrackingTarget,
} from "@bandori-stats/database/tracker";

const options = [
	makeStringOption("kind", "Event or monthly ranking")
		.required(true)
		.choices([
			{ name: "event", value: "event" },
			{ name: "monthly", value: "monthly" },
		]),
	makeIntegerOption("id", "Event or monthly ID")
		.autocomplete(true)
		.required(true),
	makeIntegerOption("music", "Music ID").autocomplete(true),
];

export const factory = createFactory<{ Bindings: Cloudflare.Env }>();
export const commands = [
	factory.autocomplete(
		makeSlashCommand(
			"t10",
			"T10 players for an event or monthly ranking",
		).options(options),
		(c) => autoCompleteTarget(c),
		(c) =>
			c.resDefer(async (c) => {
				const params = c.var as TrackingTarget;
				const metadata = await getTrackingMetadata(params);
				if (!metadata)
					return c.followup(`${params.kind}:${params.id} doesn't exist.`);

				const music =
					params.music && metadata.kind === "event"
						? metadata.musics.find(({ id }) => id === params.music)
						: undefined;
				if (params.music && !music)
					return c.followup(
						`${params.kind}:${params.id}:${params.music} doesn't exist.`,
					);

				const trackingReference = getTrackingReference({
					...metadata,
					music: music?.id,
				});
				const snapshots = await getSnapshots(trackingReference);

				const embed = makeEmbed()
					.title(metadata.name)
					.footer({
						text: music
							? `${music.title} — T10`
							: `${capitalize(params.kind)} Ranking — T10`,
					})
					.color(0x55ddee)
					.timestamp(new Date())
					.thumbnail({ url: getThumbnail(c, trackingReference) })
					.fields(
						snapshots.map(({ current, lastPlayed, playedSince }) => ({
							name: [
								bold(`#${current.rank} ${stripBB(current.name)}`),
								`${formatNumber(current.point)} Pts`,
							].join(" — "),
							value: (() => {
								const lines = [] as string[];

								lines.push(subtext(`played ${formatTimestamp(lastPlayed)}`));
								if (playedSince)
									lines.push(subtext(`since ${formatTimestamp(playedSince)}`));

								return lines.join("\n");
							})(),
						})),
					);

				return c.followup({ embeds: [embed] });
			}),
	),
	factory.autocomplete(
		makeSlashCommand(
			"cutoffs",
			"Cutoff points for an event or monthly ranking",
		).options(options),
		(c) => autoCompleteTarget(c),
		(c) =>
			c.resDefer(async (c) => {
				const params = c.var as TrackingTarget;
				const metadata = await getTrackingMetadata(params);
				if (!metadata)
					return c.followup(`${params.kind}:${params.id} doesn't exist.`);

				const music =
					params.music && metadata.kind === "event"
						? metadata.musics.find(({ id }) => id === params.music)
						: undefined;
				if (params.music && !music)
					return c.followup(
						`${params.kind}:${params.id}:${params.music} doesn't exist.`,
					);

				const trackingReference = getTrackingReference({
					...metadata,
					music: music?.id,
				});
				const cutoffs = await getCutoffs(metadata, trackingReference);

				const embed = makeEmbed()
					.title(metadata.name)
					.footer({
						text: music
							? `${music.title} — Cutoffs`
							: `${capitalize(params.kind)} Ranking — Cutoffs`,
					})
					.color(0x55ddee)
					.timestamp(new Date())
					.thumbnail({ url: getThumbnail(c, trackingReference) })
					.fields(
						cutoffs.map(({ name, rank, point, timestamp, hourly, daily }) => ({
							name: [
								bold(`#${rank} ${stripBB(name)}`),
								`${formatNumber(point)} Pts`,
							].join(" — "),
							value: (() => {
								const lines = [] as string[];

								if (hourly > 0 && daily > 0)
									lines.push(
										[
											`${formatNumber(daily)} Pts/day`,
											`${formatNumber(hourly)} Pts/hour`,
										].join(" / "),
									);
								lines.push(
									subtext(`updated ${formatTimestamp(timestamp.getTime())}`),
								);

								return lines.join("\n");
							})(),
						})),
					);

				return c.followup({ embeds: [embed] });
			}),
	),
];

const autoCompleteTarget = async (c: AutocompleteContext) => {
	const { kind, id } = c.var as TrackingTarget;
	if (kind && c.focused?.name === "id") {
		const typed = c.focused.value.toString().replace(/^#.*/, "");
		const option = {
			columns: { id: true, name: true },
			where: typed
				? typed.toString().match(/^\d+$/)
					? { id: Number(typed) }
					: { name: { like: `%${typed}%` } }
				: EmptyFilter,
			orderBy: { id: "desc" },
			limit: 25,
		} as const;

		return c.resAutocomplete(
			await (
				kind === "event"
					? db().query.gbpEvents.findMany(option)
					: db().query.gbpMonthlyRankings.findMany(option)
			).then((results) =>
				results.map(({ id, name }) => ({
					name: `#${id} — ${name}`,
					value: id,
				})),
			),
		);
	} else if (c.focused?.name === "music" && kind === "event" && id) {
		const metadata = await getTrackingMetadata({ kind, id });
		if (metadata?.kind === "event") {
			const typed = c.focused.value.toString().replace(/^#.*/, "");
			return c.resAutocomplete(
				metadata.musics
					.filter(
						({ id, title }) => id.toString() === typed || title.includes(typed),
					)
					.map(({ id, title }) => ({ name: `#${id} — ${title}`, value: id })),
			);
		}
	}

	return c.resAutocomplete([]);
};

const formatTimestamp = (ms: number) =>
	[
		time(ms / 1000, TimestampStyles.RelativeTime),
		time(ms / 1000, TimestampStyles.ShortDateShortTime),
	].join(" @ ");

const getSnapshots = async (trackingReference: TrackingReference) => {
	const getLatestRank = (rank: number, exclude?: string[]) =>
		db().query.trackerSnapshots.findFirst({
			where: {
				...trackingReference,
				rank,
				...(exclude && { uid: { notIn: exclude } }),
				bannedAt: { isNull: true },
			},
			orderBy: { id: "desc" },
		});

	const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
	const top10 = await db()
		.batch(
			ranks.map((rank) => getLatestRank(rank)) as [
				ReturnType<typeof getLatestRank>,
			],
		)
		.then((snapshots) => snapshots.filter((it) => it !== undefined))
		.then(async (snapshots) => {
			const uids = new Set<string>();
			for (const [idx, { uid, rank }] of snapshots.entries()) {
				if (uids.has(uid)) {
					const olderSnapshot = await getLatestRank(rank, [...uids]);
					if (olderSnapshot) {
						snapshots[idx] = olderSnapshot;
						uids.add(olderSnapshot.uid);
					}
				}

				uids.add(uid);
			}

			return snapshots;
		});
	if (top10.length === 0) return [];

	const players: PlayerStates =
		(await redis().hmget(
			GBP.from(trackingReference, "players"),
			...top10.flatMap(({ uid }) => [
				GBP.players.lastPlayed(uid),
				GBP.players.playedSince(uid),
			]),
		)) ?? {};

	return top10.map((current) => {
		const lastPlayed = players[`${current.uid}:last-played`] ?? {
			rank: current.rank,
			timestamp: current.timestamp.getTime(),
			pointGained: 0,
		};

		return {
			current,
			lastPlayed: lastPlayed.timestamp,
			playedSince: players[`${current.uid}:played-since`],
		};
	});
};

const getCutoffs = async (
	metadata: GbpMetadata,
	trackingReference: TrackingReference,
) => {
	const ranks = await redis().zrange<number[]>(
		GBP.from(trackingReference, "cutoffs"),
		0,
		-1,
		{ rev: true },
	);
	if (ranks.length === 0) return [];

	const hoursSince = dayjs(
		Math.min(dayjs().startOf("hour").valueOf(), metadata.endAt.getTime()),
	).diff(metadata.startAt, "hours");
	const daysSince = dayjs(Math.min(Date.now(), metadata.endAt.getTime())).diff(
		metadata.startAt,
		"days",
		true,
	);

	const getCutoffs = (rank: number) =>
		db().query.trackerCutoffs.findFirst({
			extras:
				trackingReference.trackingFor !== "music"
					? {
							hourly: (t) => sql<number>`${t.point} / ${hoursSince}`,
							daily: (t) => sql<number>`${t.point} / ${daysSince}`,
						}
					: { hourly: (_) => sql<number>`0`, daily: (_) => sql<number>`0` },
			columns: { name: true, rank: true, point: true, timestamp: true },
			where: { ...trackingReference, rank },
			orderBy: { id: "desc" },
		});

	return db()
		.batch(ranks.map(getCutoffs) as [ReturnType<typeof getCutoffs>])
		.then((snapshots) =>
			snapshots.filter((snapshot) => snapshot !== undefined),
		);
};

const getThumbnail = (
	context: CommandContext,
	{ trackingFor, trackingId }: TrackingReference,
) =>
	new URL(
		trackingFor === "music"
			? `/assets/songs/${trackingId}-cover.webp`
			: `/assets/tracker/${trackingFor}-${trackingId}-logo.webp`,
		context.event.request.url,
	).href;
