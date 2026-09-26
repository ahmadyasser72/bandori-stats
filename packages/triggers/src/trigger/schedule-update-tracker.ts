import {
	AbortTaskRunError,
	logger,
	schedules,
	tags,
	wait,
} from "@trigger.dev/sdk";
import { allKeyed, countBy, curry, pick, sum } from "es-toolkit";

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
		>(GBP.version, GBP.event.current, GBP.monthly.current, GBP.maintenance);

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

		const results = await Promise.allSettled([
			logger.trace("event-tracker", async (span) => {
				if (!event) return;
				span.setAttributes?.({
					id: event.id,
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
				if (t10.length === 0 && !musics) return;

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
				const inserted = await insertSnapshots(top, { now, metadata });
				if (inserted.length === 0) return;

				return { metadata, inserted, top };
			}),

			logger.trace("monthly-tracker", async (span) => {
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
				const inserted = await insertSnapshots(top, { now, metadata });
				if (inserted.length === 0) return;

				return { metadata, inserted, top };
			}),
		]);

		const outputs = results
			.filter((promise) => promise.status === "fulfilled")
			.filter((promise) => promise.value !== undefined)
			.map((promise) => promise.value!);

		if (outputs.length > 0 && now.get("minutes") === 0) {
			await markBannedPlayers(
				outputs.map(({ metadata, top }) => ({
					top,
					trackingReference: getTrackingReference(metadata),
				})),
				now,
			);

			await discordTracker.trigger({
				metadatas: outputs.map(({ metadata }) => metadata),
			});
		}

		const errors = results.filter((promise) => promise.status === "rejected");
		const abortErrors = [] as string[];
		for (const { reason } of errors) {
			if (reason instanceof AbortTaskRunError) abortErrors.push(reason.message);
			else console.error(reason);
		}
		if (errors.length > 0) await tags.add("error_settled");

		const inserted = outputs.flatMap(({ inserted }) => inserted);
		if (inserted.length > 0) {
			const snapshots = await logger.trace(
				"get-previous-snapshots",
				async (span) => {
					const getPreviousSnapshot = ({
						id,
						trackingFor,
						trackingId,
						uid,
					}: (typeof inserted)[number]) =>
						db().query.trackerSnapshots.findFirst({
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
					span.setAttribute("snapshots", JSON.stringify(snapshots));

					return snapshots;
				},
			);

			await updateTrackerProfile.trigger({
				players: snapshots.map(
					({ value: { uid, trackingFor, trackingId }, updated }) => ({
						uid,
						trackingReference: { trackingFor, trackingId },
						updateBand: updated,
					}),
				),
			});

			const updated = snapshots.filter(
				({ value: { trackingFor }, updated }) =>
					trackingFor !== "music" && updated,
			);
			if (updated.length > 0) {
				await logger.trace("update-played-since", async (span) => {
					const keys = updated.map(
						({ value: { uid, trackingFor, trackingId } }) =>
							GBP.fromMetadata(
								{ kind: trackingFor as "event" | "monthly", id: trackingId },
								uid,
								"played-since",
							),
					);
					span.setAttribute("key", keys);

					await keys
						.reduce(
							(pipe, key) =>
								pipe.set(key, now.valueOf(), { ex: 60 * 10, nx: true }),
							redis().pipeline(),
						)
						.exec();
				});
			}
		}

		for (const { metadata, top } of outputs) {
			if (!now.isSame(metadata.endAt, "hours")) continue;

			const trackingReference = getTrackingReference(metadata);
			await updateTrackerProfile.trigger(
				{
					players: [
						...top.t10.map(({ userId }) => ({
							uid: userId,
							trackingReference,
							updateBand: false,
						})),
						...("musics" in top && top.musics
							? top.musics.flatMap(({ id, t10 }) =>
									t10.map(({ userId }) => ({
										uid: userId,
										trackingReference: {
											trackingFor: "music" as const,
											trackingId: id,
										},
										updateBand: false,
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

		if (abortErrors.length > 0)
			throw new AbortTaskRunError(abortErrors.join("\n"));
	},
});

interface Ranking {
	t10: RankingUser[];
	cutoffs: RankingUser[];
	musics?: { id: number; t10: RankingUser[]; cutoffs: RankingUser[] }[];
}

interface InsertSnapshotOptions {
	now: dayjs.Dayjs;
	metadata: GbpMetadata;
}

const insertSnapshots = async (
	ranking: Ranking,
	{ now, metadata }: InsertSnapshotOptions,
) => {
	const hourlyUpdate = now.get("minutes") === 0;
	const updateMusics =
		hourlyUpdate &&
		metadata.kind === "event" &&
		metadata.musics.length > 0 &&
		!!ranking.musics;

	const updated = await logger.trace(
		`update-${metadata.kind}-redis`,
		async (span) => {
			const added = [] as string[];
			const pipe = redis().pipeline();
			const add = (
				suffix: string | string[],
				[first, ...rest]: RankingUser[],
				memberKey: "rank" | "userId",
			) => {
				if (!first) return;

				const key = GBP.fromMetadata(
					metadata,
					...(Array.isArray(suffix) ? suffix : [suffix]),
				);
				added.push(key);
				pipe.zadd(
					key,
					{ gt: true, ch: true },
					{ member: first[memberKey], score: Number(first.point) },
					...rest.map((it) => ({
						member: it[memberKey],
						score: Number(it.point),
					})),
				);
			};

			add("leaderboard", ranking.t10, "userId");
			if (hourlyUpdate) add("cutoffs", ranking.cutoffs, "rank");

			if (updateMusics) {
				for (const { id, t10, cutoffs } of ranking.musics!) {
					const musicId = metadata.type === "medley" ? "medley" : id.toString();
					add(["leaderboard-music", musicId], t10, "userId");
					add(["cutoffs-music", musicId], cutoffs, "rank");
				}
			}

			const results = await pipe.exec<number[]>();
			for (const [idx, key] of added.entries())
				span.setAttribute(key, results[idx]);

			return sum(results);
		},
	);

	if (updated === 0) return [];
	else await tags.add(`${metadata.kind}_redis`);

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
		if (!hourlyUpdate) return;

		const { cards } = await getRedisData({
			cards: [
				...ranking.cutoffs,
				...(ranking.musics?.flatMap(({ cutoffs }) => cutoffs) ?? []),
			].map(({ userProfileSituation }) => userProfileSituation?.situationId),
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
								cards.get(userProfileSituation.situationId)!,
							)
						: null,
			}),
		);
	})();

	const snapshots = [] as (typeof trackerSnapshots.$inferInsert)[];
	const cutoffs = [] as (typeof trackerCutoffs.$inferInsert)[];

	{
		const trackingReference = getTrackingReference(metadata);
		snapshots.push(...ranking.t10.map(toTrackerSnapshot(trackingReference)));
		if (toTrackerCutoff)
			cutoffs.push(...ranking.cutoffs.map(toTrackerCutoff(trackingReference)));
	}

	if (updateMusics) {
		for (const music of ranking.musics!) {
			const trackingReference = {
				trackingFor: "music" as const,
				trackingId: music.id,
			};

			snapshots.push(...music.t10.map(toTrackerSnapshot(trackingReference)));
			cutoffs.push(...music.cutoffs.map(toTrackerCutoff!(trackingReference)));
		}
	}

	return logger.trace(`insert-${metadata.kind}`, async (span) => {
		const [newSnapshots, newCutoffs] = await db().batch([
			db()
				.insert(trackerSnapshots)
				.values(snapshots)
				.onConflictDoNothing()
				.returning(),
			...(cutoffs.length > 0
				? [
						db()
							.insert(trackerCutoffs)
							.values(cutoffs)
							.onConflictDoUpdate({
								target: [
									trackerCutoffs.trackingFor,
									trackerCutoffs.trackingId,
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
							}),
					]
				: []),
		]);

		const groupByKind = ({ trackingFor, trackingId }: TrackingReference) =>
			trackingFor === metadata.kind && trackingId === metadata.id
				? trackingFor
				: `${trackingFor}:${trackingId}`;

		const newSnapshotsByKind = countBy(newSnapshots, groupByKind);
		await tags.add(
			Object.keys(newSnapshotsByKind).map((kind) => `${kind}_snapshots`),
		);
		for (const [kind, count] of Object.entries(newSnapshotsByKind))
			span.setAttribute(`${kind}:snapshots`, count);

		if (cutoffs.length > 0) {
			const newCutoffsByKind = countBy(newCutoffs, groupByKind);
			await tags.add(
				Object.keys(newCutoffsByKind).map((kind) => `${kind}_cutoffs`),
			);
			for (const [kind, count] of Object.entries(newCutoffsByKind))
				span.setAttribute(`${kind}:cutoffs`, count);
		}

		return newSnapshots;
	});
};

export const markBannedPlayers = async (
	targets: { top: Ranking; trackingReference: TrackingReference }[],
	now: dayjs.Dayjs,
) => {
	const conditions = [] as Parameters<typeof or>;
	for (const {
		top,
		trackingReference: { trackingFor, trackingId },
	} of targets) {
		conditions.push(
			and(
				eq(trackerSnapshots.trackingFor, trackingFor),
				eq(trackerSnapshots.trackingId, trackingId),
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
		const result = await db()
			.update(trackerSnapshots)
			.set({ bannedAt: now.toDate() })
			.where(filter);
		span.setAttribute("marked", result.rowsAffected);
	});
};
