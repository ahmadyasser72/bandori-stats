import { logger, metadata, schedules, tags, wait } from "@trigger.dev/sdk";
import {
	allKeyed,
	countBy,
	curry,
	groupBy,
	mapValues,
	mapValuesAsync,
	pick,
	zip,
} from "es-toolkit";
import { uniqBy } from "es-toolkit/compat";

import dayjs from "@bandori-stats/bestdori/date";
import {
	and,
	db,
	eq,
	gt,
	isNull,
	notInArray,
	or,
	sql,
} from "@bandori-stats/database";
import { GBP, getRedisData, redis } from "@bandori-stats/database/redis";
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
						const data = await bangDream(version, event.type, event.id);
						return {
							t10: data.eventPointTopUsers?.entries,
							cutoffs: data.eventPointBorderUsers?.entries,
							musics: data.versusMusicRankings,
						};
					} else if (event.type === "medley") {
						const data = await bangDream(version, event.type, event.id);
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
						const data = await bangDream(version, event.type, event.id);
						return {
							t10: data.eventPointTopUsers?.entries,
							cutoffs: data.eventPointBorderUsers?.entries,
							musics: data.challengeMusicRankings,
						};
					} else if (event.type === "mission_live") {
						const data = await bangDream(version, event.type, event.id);
						return {
							t10: data.topUsers?.entries,
							cutoffs: data.borderUsers?.entries,
						};
					} else if (event.type === "live_try" || event.type === "festival") {
						const data = await bangDream(version, event.type, event.id);
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

				const data = await bangDream(version, "monthly", monthly.id);
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
			const toInsert = [] as {
				trackingReference: TrackingReference;
				values: RankingUser[];
				type: "t10" | "cutoffs";
			}[];

			const keys = [] as string[];
			const pipe = redis().pipeline();
			for (const { metadata, top } of targets) {
				const addMembers = (
					trackingReference: TrackingReference,
					players: RankingUser[],
					type: "t10" | "cutoffs",
				) => {
					toInsert.push({ trackingReference, values: players, type });

					const key = GBP.from(trackingReference, type);
					keys.push(key);
					pipe.zadd(
						key,
						{ gt: true, ch: true },
						...(players.map((it) => ({
							member: it[type === "cutoffs" ? "userId" : "rank"],
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

			const changes = await pipe.exec<number[]>();
			span.setAttributes(Object.fromEntries(zip(keys, changes)));

			return toInsert.filter((_, idx) => changes[idx] > 0);
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
								.onConflictDoUpdate({
									target: [
										trackerCutoffs.trackingFor,
										trackerCutoffs.trackingId,
										trackerCutoffs.trackingEventId,
										trackerCutoffs.rank,
										trackerCutoffs.point,
									],
									set: {
										name: sql.raw(`excluded.${trackerCutoffs.name.name}`),
										avatar: sql.raw(`excluded.${trackerCutoffs.avatar.name}`),
									},
								})
								.returning({
									trackingFor: trackerCutoffs.trackingFor,
									trackingId: trackerCutoffs.trackingId,
									trackingEventId: trackerCutoffs.trackingEventId,
								})
						: [],
			});

			const group = ({
				trackingFor,
				trackingId,
				trackingEventId,
			}: (typeof inserted.cutoffs)[number]) =>
				GBP.from({
					trackingFor,
					trackingId,
					trackingEventId: trackingEventId ?? undefined,
				});

			const updatedSnapshots = countBy(inserted.snapshots, group);
			for (const kind in updatedSnapshots)
				span.setAttribute(`${kind}:snapshots`, updatedSnapshots[kind]);
			const updatedCutoffs = countBy(inserted.cutoffs, group);
			for (const kind in updatedCutoffs)
				span.setAttribute(`${kind}:cutoffs`, updatedCutoffs[kind]);

			return inserted.snapshots;
		});

		if (targets.length > 0 && now.get("minutes") === 0) {
			await markBannedPlayers(
				targets.map(({ metadata, top }) => ({
					top,
					trackingReference: getTrackingReference(metadata),
				})),
				now,
			);

			await discordTracker.trigger({
				metadatas: targets.map(({ metadata }) => metadata),
			});
		}

		if (inserted.length > 0) {
			const snapshots = await logger.trace(
				"fetch-previous-snapshots",
				async () => {
					const getPreviousSnapshot = ({
						id,
						trackingFor,
						trackingId,
						uid,
					}: (typeof inserted)[number]) =>
						db().query.trackerSnapshots.findFirst({
							columns: { point: true },
							where: { trackingFor, trackingId, uid, id: { lt: id } },
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
							updated: !previous || value.point !== previous.point,
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
						updated,
					}) => ({
						uid,
						trackingReference: {
							trackingFor,
							trackingId,
							trackingEventId: trackingEventId ?? undefined,
						},
						changed: updated,
					}),
				),
			});

			const updated = snapshots.filter(
				({ value: { trackingFor }, updated }) =>
					trackingFor !== "music" && updated,
			);
			if (updated.length > 0) {
				await logger.trace("update-player-state", async (span) => {
					const grouped = groupBy(updated, ({ value }) =>
						GBP.from(pick(value, ["trackingFor", "trackingId"]), "players"),
					);

					const playedSince = await mapValuesAsync(
						grouped,
						async (values, key) => {
							const keys = values.map(
								({ value: { uid } }) => `${uid}:played-since`,
							);
							const entries: Record<string, number> =
								(await redis().hmget(key, ...keys)) ?? {};
							for (const uid of keys) entries[uid] ??= now.valueOf();

							return entries;
						},
					);
					const lastPlayed = mapValues(grouped, (values) =>
						Object.fromEntries(
							values.map(({ value: { uid, rank, timestamp } }) => [
								`${uid}:last-played`,
								{ rank, timestamp: timestamp.getTime() },
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

export const markBannedPlayers = async (
	targets: { top: Ranking; trackingReference: TrackingReference }[],
	now: dayjs.Dayjs,
) => {
	const conditions = [] as Parameters<typeof or>;
	for (const {
		top,
		trackingReference: { trackingFor, trackingId, trackingEventId },
	} of targets) {
		conditions.push(
			and(
				eq(trackerSnapshots.trackingFor, trackingFor),
				eq(trackerSnapshots.trackingId, trackingId),
				trackingEventId
					? eq(trackerSnapshots.trackingEventId, trackingEventId)
					: isNull(trackerSnapshots.trackingEventId),
				notInArray(
					trackerSnapshots.uid,
					top.t10.map(({ userId }) => userId),
				),
				gt(
					trackerSnapshots.point,
					Math.min(...top.t10.map(({ point }) => Number(point))),
				),
			),
		);

		if (trackingFor === "event" && top.musics) {
			for (const { id, t10 } of top.musics) {
				conditions.push(
					and(
						eq(trackerSnapshots.trackingFor, "music"),
						eq(trackerSnapshots.trackingId, id),
						notInArray(
							trackerSnapshots.uid,
							t10.map(({ userId }) => userId),
						),
						gt(
							trackerSnapshots.point,
							Math.min(...t10.map(({ point }) => Number(point))),
						),
					),
				);
			}
		}
	}

	await logger.trace("mark-banned-players", async (span) => {
		const filter = and(or(...conditions), isNull(trackerSnapshots.bannedAt));
		span.setAttribute("filter", String(filter?.getSQL()));
		span.setAttribute("bannedAt", now.toISOString());
		const results = await db()
			.update(trackerSnapshots)
			.set({ bannedAt: now.toDate() })
			.where(filter)
			.returning({
				trackingFor: trackerSnapshots.trackingFor,
				trackingId: trackerSnapshots.trackingId,
				uid: trackerSnapshots.uid,
			});

		const updated = uniqBy(results, (value) => Object.values(value).join(":"));
		if (updated.length === 0) return;

		metadata.set("marked-banned", updated);
	});
};
