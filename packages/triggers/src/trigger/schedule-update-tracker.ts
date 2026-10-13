import { logger, metadata, schedules, tags, wait } from "@trigger.dev/sdk";
import {
	allKeyed,
	countBy,
	curry,
	groupBy,
	mapKeys,
	mapValues,
	mapValuesAsync,
	pick,
	zip,
} from "es-toolkit";
import xxhash from "xxhash-wasm";

import dayjs from "@bandori-stats/bestdori/date";
import { and, db, eq, inArray, or } from "@bandori-stats/database";
import {
	GBP,
	getRedisData,
	redis,
	type PlayerLastPlayed,
} from "@bandori-stats/database/redis";
import {
	trackerCutoffs,
	trackerSnapshots,
	type GbpMetadata,
} from "@bandori-stats/database/schema";
import {
	getTrackingReference,
	TrackingReference,
} from "@bandori-stats/database/tracker";
import { bangDream } from "~/bang-dream-gbp/fetch";
import type {
	MusicRankingResponse,
	RankingUser,
} from "~/bang-dream-gbp/gen/common_pb";
import { discordTracker } from "./discord-tracker";
import { getAvatar, updateTrackerProfile } from "./update-tracker-profile";

export const scheduleUpdateTracker = schedules.task({
	id: "schedule-update-tracker",
	ttl: "1m",
	cron: { pattern: "* * * * *" },
	run: async ({ timestamp }) => {
		const [version, eventId, monthlyId, maintenance] = await redis().mget<
			[string | null, number | null, number | null, true | null]
		>(GBP.version, GBP.event, GBP.monthly, GBP.maintenance);

		await tags.add(`version_${version ?? "n/a"}`);
		if (!version || (!eventId && !monthlyId)) return;

		const { event, monthly } = await allKeyed({
			event:
				eventId &&
				db().query.gbpEvents.findFirst({
					where: { id: eventId },
					with: { musics: true },
				}),
			monthly:
				monthlyId &&
				db().query.gbpMonthlyRankings.findFirst({ where: { id: monthlyId } }),
		});
		await tags.add([
			`event_${event ? event.assetBundleName : (eventId ?? "n/a")}`,
			`monthly_${monthly ? monthly.assetBundleName : (monthlyId ?? "n/a")}`,
		]);

		if (maintenance) {
			await tags.add("maintenance_skip");
			return;
		}

		const now = dayjs(timestamp).startOf("minute").add(1, "minute");
		await wait.until({ date: now.toDate() });

		const rankings = await Promise.all([
			logger.trace("fetch-event-ranking", async (span) => {
				if (!event) return;
				span.setAttributes?.({
					id: event.id,
					type: event.type,
					startAt: event.startAt.toISOString(),
					endAt: event.endAt.toISOString(),
				});
				if (now.isBefore(event.startAt)) return;

				const {
					t10 = [],
					cutoffs = [],
					musics,
				} = await (async () => {
					if (event.type === "versus") {
						const data = await bangDream.leaderboard(
							version,
							event.type,
							event.id,
						);
						return {
							t10: data.eventPointTopUsers?.entries,
							cutoffs: data.eventPointBorderUsers?.entries,
							musics: data.versusMusicRankings,
						};
					} else if (event.type === "medley") {
						const data = await bangDream.leaderboard(
							version,
							event.type,
							event.id,
						);
						return {
							t10: data.eventPointTopUsers?.entries,
							cutoffs: data.eventPointBorderUsers?.entries,
							musics: [
								{
									$typeName: "MusicRankingResponse",
									musicId: event.musics[0].id,
									...pick(data, ["scoreBorderUsers", "scoreTopUsers"]),
								} satisfies MusicRankingResponse,
							],
						};
					} else if (event.type === "challenge") {
						const data = await bangDream.leaderboard(
							version,
							event.type,
							event.id,
						);
						return {
							t10: data.eventPointTopUsers?.entries,
							cutoffs: data.eventPointBorderUsers?.entries,
							musics: data.challengeMusicRankings,
						};
					} else if (event.type === "mission_live") {
						const data = await bangDream.leaderboard(
							version,
							event.type,
							event.id,
						);
						return {
							t10: data.topUsers?.entries,
							cutoffs: data.borderUsers?.entries,
						};
					} else if (event.type === "live_try" || event.type === "festival") {
						const data = await bangDream.leaderboard(
							version,
							event.type,
							event.id,
						);
						return {
							t10: data.topUsers?.entries,
							cutoffs: data.eventPointBorderUsers?.entries,
						};
					}
					// } else if (event.type === "story") {
					// 	// legacy events, skip
					// 	return [];
					// }

					return {};
				})();
				if (t10.length === 0) return;

				const top = {
					t10,
					cutoffs,
					musics: musics?.map(
						({ musicId, scoreBorderUsers, scoreTopUsers }) => ({
							id: musicId,
							t10: scoreTopUsers?.entries ?? [],
							cutoffs: scoreBorderUsers?.entries ?? [],
						}),
					),
				} satisfies Ranking;

				const metadata: GbpMetadata = { kind: "event", ...event };
				return { metadata, top };
			}),
			logger.trace("fetch-monthly-ranking", async (span) => {
				if (!monthly) return;
				span.setAttributes?.({
					id: monthly.id,
					startAt: monthly.startAt.toISOString(),
					endAt: monthly.endAt.toISOString(),
				});
				if (now.isBefore(monthly.startAt)) return;

				const data = await bangDream.leaderboard(
					version,
					"monthly",
					monthly.id,
				);
				const t10 = data.monthlyRankingPointTopUsers?.entries ?? [];
				const cutoffs = data.monthlyRankingPointBorderUsers?.entries ?? [];
				if (t10.length === 0) return;

				const top = { t10, cutoffs } satisfies Ranking;
				const metadata: GbpMetadata = { kind: "monthly", ...monthly };
				return { metadata, top };
			}),
		]);

		const targets = rankings.filter((ranking) => !!ranking);
		if (targets.length === 0) return;

		const updateCutoffs = now.get("minutes") === 0;
		if (updateCutoffs) await tags.add("cutoffs");

		const updated = await logger.trace("update-redis", async (span) => {
			const { h32ToString } = await xxhash();

			const toInsert = [] as {
				trackingReference: TrackingReference;
				values: RankingUser[];
				type: "t10" | "cutoffs";
			}[];

			const types: ("t10" | "cutoffs")[] = updateCutoffs
				? ["t10", "cutoffs"]
				: ["t10"];
			const rankingHash =
				(await redis().hmget<Record<string, string>>(
					GBP.trackerHash,
					...targets.flatMap(({ metadata }) => {
						const trackingReference = getTrackingReference(metadata);
						if (metadata.kind !== "event" || metadata.musics.length === 0)
							return types.map((type) => GBP.from(trackingReference, type));

						return types.flatMap((type) =>
							[
								trackingReference,
								...metadata.musics.map(({ id }) =>
									getTrackingReference({ ...metadata, music: id }),
								),
							].map((trackingReference) => GBP.from(trackingReference, type)),
						);
					}),
				)) ?? {};

			const keys = [] as string[];
			const pipe = redis().pipeline();
			for (const { metadata, top } of targets) {
				const addMembers = (
					trackingReference: TrackingReference,
					players: RankingUser[],
					type: "t10" | "cutoffs",
				) => {
					const member = type === "cutoffs" ? "rank" : "userId";
					const key = GBP.from(trackingReference, type);
					const hash = h32ToString(
						players
							.map((it) => [it[member], Number(it.point)].join(":"))
							.join("|"),
					);

					if (rankingHash[key] === hash) return;
					else rankingHash[key] = hash;

					toInsert.push({ trackingReference, values: players, type });
					keys.push(key);
					pipe.zadd(
						key,
						{ gt: true, ch: true },
						...(players.map((it) => ({
							member: it[member],
							score: Number(it.point),
						})) as [{ member: number; score: number }]),
					);
				};

				const target = getTrackingReference(metadata);
				addMembers(target, top.t10, "t10");
				if (updateCutoffs) addMembers(target, top.cutoffs, "cutoffs");

				if (metadata.kind === "event" && "musics" in top && !!top.musics) {
					for (const { id, t10, cutoffs } of top.musics) {
						const target = getTrackingReference({ ...metadata, music: id });
						addMembers(target, t10, "t10");
						if (updateCutoffs) addMembers(target, cutoffs, "cutoffs");
					}
				}
			}

			if (toInsert.length === 0) return [];

			const changes = await pipe
				.hset(GBP.trackerHash, rankingHash)
				.exec<number[]>();
			span.setAttributes({
				...Object.fromEntries(zip(keys, changes.slice(0, keys.length))),
				...mapKeys(rankingHash, (_, key) => `hash:${key}`),
			});

			return toInsert;
		});

		const inserted = await logger.trace("insert-snapshots", async (span) => {
			if (updated.length === 0) return [];

			const toTrackerSnapshot = curry(
				(
					trackingReference: TrackingReference,
					{ userId, name, rank, point }: RankingUser,
				): typeof trackerSnapshots.$inferInsert => ({
					...trackingReference,

					uid: userId,
					name,
					rank,
					point: Number(point),
					timestamp: now.toDate(),
				}),
			);
			const toTrackerCutoff = await (async () => {
				if (!updateCutoffs) return;

				const { cards } = await getRedisData({
					cards: updated
						.filter(({ type }) => type === "cutoffs")
						.flatMap(({ values }) =>
							values.map(
								({ userProfileSituation }) => userProfileSituation?.situationId,
							),
						),
				});
				return curry(
					(
						trackingReference: TrackingReference,
						{ name, rank, point, userProfileSituation }: RankingUser,
					): typeof trackerCutoffs.$inferInsert => ({
						...trackingReference,

						name,
						rank,
						point: Number(point),
						timestamp: now.toDate(),
						avatar:
							userProfileSituation && userProfileSituation.situationId
								? getAvatar(
										userProfileSituation,
										cards[userProfileSituation.situationId],
									)
								: null,
					}),
				);
			})();

			const snapshots = [] as (typeof trackerSnapshots.$inferInsert)[];
			const cutoffs = [] as (typeof trackerCutoffs.$inferInsert)[];
			for (const { trackingReference, values, type } of updated) {
				if (type === "t10")
					snapshots.push(...values.map(toTrackerSnapshot(trackingReference)));
				else if (type === "cutoffs" && toTrackerCutoff)
					cutoffs.push(...values.map(toTrackerCutoff(trackingReference)));
			}

			metadata.set("insert-values", { snapshots, cutoffs } as never);
			if (snapshots.length === 0 && cutoffs.length === 0) return [];

			const inserted = await allKeyed({
				snapshots:
					snapshots.length > 0
						? db()
								.insert(trackerSnapshots)
								.values(snapshots)
								.onConflictDoNothing()
								.returning()
						: [],
				cutoffs:
					cutoffs.length > 0
						? db()
								.insert(trackerCutoffs)
								.values(cutoffs)
								.onConflictDoNothing()
								.returning({
									trackingFor: trackerCutoffs.trackingFor,
									trackingId: trackerCutoffs.trackingId,
									trackingEventId: trackerCutoffs.trackingEventId,
								})
						: [],
			});

			const group = (value: (typeof inserted.cutoffs)[number]) =>
				GBP.from(value);

			const updatedSnapshots = countBy(inserted.snapshots, group);
			for (const kind in updatedSnapshots)
				span.setAttribute(`${kind}:snapshots`, updatedSnapshots[kind]);
			const updatedCutoffs = countBy(inserted.cutoffs, group);
			for (const kind in updatedCutoffs)
				span.setAttribute(`${kind}:cutoffs`, updatedCutoffs[kind]);

			return inserted.snapshots;
		});

		await logger.trace("mark-banned-players", async (span) => {
			const updatedT10 = updated.filter(({ type }) => type === "t10");
			if (updatedT10.length === 0) return [];

			const t10 = await updatedT10
				.reduce(
					(pipe, { trackingReference, type }) =>
						pipe.zrange(GBP.from(trackingReference, type), 0, 9, { rev: true }),
					redis().pipeline(),
				)
				.exec<number[][]>()
				.then((results) => results.map((values) => values.map(String)));
			const pending = updatedT10
				.map(({ values, ...target }, idx) => {
					const uids = values.map(({ userId }) => userId);
					return {
						uids: t10[idx].filter((uid) => !uids.includes(uid)),
						...target,
					};
				})
				.filter(({ uids }) => uids.length > 0);
			if (pending.length === 0) return;

			await pending
				.reduce(
					(pipe, { trackingReference, type, uids }) =>
						pipe.zrem(GBP.from(trackingReference, type), ...uids),
					redis().pipeline(),
				)
				.exec();
			const result = await db()
				.update(trackerSnapshots)
				.set({ bannedAt: now.toDate() })
				.where(
					or(
						...pending.map(
							({
								trackingReference: { trackingFor, trackingId, trackingEventId },
								uids,
							}) =>
								and(
									eq(trackerSnapshots.trackingFor, trackingFor),
									eq(trackerSnapshots.trackingId, trackingId),
									eq(trackerSnapshots.trackingEventId, trackingEventId),
									inArray(trackerSnapshots.uid, uids),
								),
						),
					),
				);

			span.setAttribute("marked", result.rowsAffected);
		});

		if (targets.length > 0 && now.get("minutes") === 0)
			await discordTracker.trigger({
				metadatas: targets.map(({ metadata }) => metadata),
			});

		if (inserted.length > 0) {
			const snapshots = await logger.trace(
				"fetch-previous-snapshots",
				async () => {
					const getPreviousSnapshot = ({
						id,
						trackingFor,
						trackingId,
						trackingEventId,
						uid,
					}: (typeof inserted)[number]) =>
						db().query.trackerSnapshots.findFirst({
							columns: { point: true },
							where: {
								trackingFor,
								trackingId,
								trackingEventId,
								uid,
								id: { lt: id },
							},
							orderBy: { id: "desc" },
						});
					const previousSnapshots = await db().batch(
						inserted.map(getPreviousSnapshot) as [
							ReturnType<typeof getPreviousSnapshot>,
						],
					);

					const snapshots = inserted.map((value, idx) => {
						const previous = previousSnapshots.at(idx);
						return {
							value,
							pointGained: previous ? value.point - previous.point : 0,
						};
					});
					metadata.set("inserted", snapshots as never);

					return snapshots;
				},
			);

			await updateTrackerProfile.trigger({
				version,
				players: snapshots.map(
					({
						value: { uid, trackingFor, trackingId, trackingEventId },
						pointGained,
					}) => ({
						uid,
						trackingReference: { trackingFor, trackingId, trackingEventId },
						changed: pointGained !== 0,
					}),
				),
			});

			const changed = snapshots.filter(
				({ value: { trackingFor }, pointGained }) =>
					trackingFor !== "music" && pointGained > 0,
			);
			if (changed.length > 0) {
				await logger.trace("update-player-state", async (span) => {
					const grouped = groupBy(changed, ({ value }) =>
						GBP.from(value, "players"),
					);

					const playedSince = await mapValuesAsync(
						grouped,
						async (values, key) => {
							const keys = values.map(({ value: { uid } }) =>
								GBP.players.playedSince(uid),
							);
							const entries: Record<string, number> =
								(await redis().hmget(key, ...keys)) ?? {};
							for (const uid of keys) entries[uid] ??= now.valueOf();

							return entries;
						},
					);
					const lastPlayed = mapValues(grouped, (values) =>
						Object.fromEntries(
							values.map(({ value: { uid, rank, timestamp }, pointGained }) => [
								GBP.players.lastPlayed(uid),
								{
									rank,
									timestamp: timestamp.getTime(),
									pointGained,
								} satisfies PlayerLastPlayed,
							]),
						),
					);

					metadata.set("players-state", { playedSince, lastPlayed });

					const pipe = redis().pipeline();
					for (const key in grouped)
						pipe
							.hset(key, lastPlayed[key])
							.hsetex(key, { expiration: { ex: 30 * 60 } }, playedSince[key]);

					const responses = await pipe.exec<number[]>();
					span.setAttribute("responses", responses);
				});
			}
		}

		for (const { metadata, top } of targets) {
			if (!now.isSame(metadata.endAt, "hours")) continue;

			const trackingReference = getTrackingReference(metadata);
			await updateTrackerProfile.trigger(
				{
					version,
					players: [
						...top.t10.map(({ userId }) => ({
							uid: userId,
							trackingReference,
							changed: false,
						})),
						...("musics" in top && top.musics
							? top.musics.flatMap(({ id, t10 }) =>
									t10.map(({ userId }) => ({
										uid: userId,
										trackingReference: {
											trackingFor: "music" as const,
											trackingId: id,
											trackingEventId: metadata.id,
										},
										changed: false,
									})),
								)
							: []),
					],
				},
				{
					delay: "1d",
					idempotencyKey: `${metadata.kind}:${metadata.id}:last-profile-update`,
				},
			);
		}
	},
});

interface Ranking {
	t10: RankingUser[];
	cutoffs: RankingUser[];
	musics?: { id: number; t10: RankingUser[]; cutoffs: RankingUser[] }[];
}
