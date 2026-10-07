import { bold, subtext, time, TimestampStyles } from "@discordjs/formatters";
import {
	createFactory,
	makeEmbed,
	makeIntegerOption,
	makeSlashCommand,
	makeStringOption,
	type AutocompleteContext,
} from "discord-hono";
import { capitalize } from "es-toolkit";

import { formatNumber, stripBB } from "@bandori-stats/bestdori/helpers";
import { db, EmptyFilter } from "@bandori-stats/database";
import { GBP, redis, type PlayerStates } from "@bandori-stats/database/redis";
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
				const trackingReference = getTrackingReference({
					...metadata,
					music: music?.id,
				});
				const snapshots = await getSnapshots(trackingReference);

				const fields = [] as { name: string; value: string }[];
				for (const { current, lastPlayed, playedSince } of snapshots) {
					const points = `${formatNumber(current.point)} Pts`;

					fields.push({
						name: [
							bold(`#${current.rank} ${stripBB(current.name)}`),
							points,
						].join(" — "),
						value: (() => {
							const lines = [] as string[];

							const timestamp = (ms: number) =>
								[
									time(ms / 1000, TimestampStyles.RelativeTime),
									time(ms / 1000, TimestampStyles.ShortDateShortTime),
								].join(" @ ");

							lines.push(subtext(`Last played ${timestamp(lastPlayed)}`));
							if (playedSince)
								lines.push(subtext(`since ${timestamp(playedSince)}`));

							return lines.join("\n");
						})(),
					});
				}

				return c.followup({
					embeds: [
						makeEmbed()
							.title(metadata.name)
							.footer({
								text: music
									? `${music.title} — T10`
									: `${capitalize(params.kind)} Ranking — T10`,
							})
							.color(0x55ddee)
							.fields(fields)
							.timestamp(new Date()),
					],
				});
			}),
	),
	// factory.autocomplete(
	// 	makeSlashCommand(
	// 		"cutoffs",
	// 		"Cutoff points for an event or monthly ranking",
	// 	).options(options),
	// 	(c) => autoCompleteTarget(c),
	// 	(c) => {
	// 		c;
	// 	},
	// ),
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
