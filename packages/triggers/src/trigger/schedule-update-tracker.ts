import { logger, schedules, tags, wait } from "@trigger.dev/sdk";
import { allKeyed, countBy, curry, pick, uniqBy } from "es-toolkit";
import webPush from "web-push";

import dayjs from "@bandori-stats/bestdori/date";
import { formatNumber } from "@bandori-stats/bestdori/helpers";
import { db, sql } from "@bandori-stats/database";
import {
	GBP,
	getCards,
	redis,
	type NotifyWhenPlayer,
} from "@bandori-stats/database/redis";
import {
	trackerCutoffs,
	trackerSnapshots,
	type GbpMetadata,
} from "@bandori-stats/database/schema";
import { getTrackingReference } from "@bandori-stats/database/tracker";
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
		const [version, eventId, monthlyId] = await redis().mget<
			[string | null, number | null, number | null]
		>(GBP.version, GBP.event.current, GBP.monthly.current);

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

		const now = dayjs(timestamp).startOf("minute").add(1, "minute");
		await wait.until({ date: now.toDate() });

		const results = await Promise.allSettled([
			logger.trace("event-tracker", async (span) => {
				if (!event) return [];
				span.setAttributes?.({
					id: event.id,
					startAt: event.startAt.toISOString(),
					endAt: event.endAt.toISOString(),
				});
				if (now.isBefore(event.startAt)) return [];

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
				if (t10.length === 0 && !musics) return [];

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
				if (inserted.length === 0) return [];

				await sendPushNotifications(top, { now, metadata });

				return inserted;
			}),

			logger.trace("monthly-tracker", async (span) => {
				if (!monthly) return [];
				span.setAttributes?.({
					id: monthly.id,
					startAt: monthly.startAt.toISOString(),
					endAt: monthly.endAt.toISOString(),
				});
				if (now.isBefore(monthly.startAt)) return [];

				const data = await bangDream(version, "monthly", monthly.id);
				const t10 = data.monthlyRankingPointTopUsers?.entries ?? [];
				const cutoffs = data.monthlyRankingPointBorderUsers?.entries ?? [];
				if (t10.length === 0) return [];

				const top = { t10, cutoffs } satisfies Ranking;
				const metadata: GbpMetadata = { kind: "monthly", ...monthly };
				const inserted = await insertSnapshots(top, { now, metadata });
				if (inserted.length === 0) return [];

				await sendPushNotifications(top, { now, metadata });

				return inserted;
			}),
		]);

		if (now.get("minutes") === 0) {
			const metadatas = [] as GbpMetadata[];
			if (event) metadatas.push({ kind: "event", ...event });
			if (monthly) metadatas.push({ kind: "monthly", ...monthly });

			if (metadatas.length > 0) await discordTracker.trigger({ metadatas });
		}

		const errors = results.filter((promise) => promise.status === "rejected");
		for (const { reason } of errors) console.error(reason);
		if (errors.length > 0) await tags.add("error_settled");

		const inserted = results
			.filter((promise) => promise.status === "fulfilled")
			.flatMap(({ value }) => value);

		if (inserted.length > 0) {
			await updateTrackerProfile.trigger({
				players: inserted.map(({ uid, trackingFor, trackingId }) => ({
					uid,
					trackingReference: { trackingFor, trackingId },
				})),
			});
		}
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

	const toTrackerSnapshot = curry(
		(
			trackingReference: Pick<
				typeof trackerSnapshots.$inferInsert,
				"trackingFor" | "trackingId"
			>,
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

		const cards = await getCards(
			[
				...ranking.cutoffs,
				...(ranking.musics?.flatMap(({ cutoffs }) => cutoffs) ?? []),
			].map(({ userProfileSituation }) => userProfileSituation?.situationId),
		);
		return curry(
			(
				trackingReference: Pick<
					typeof trackerSnapshots.$inferInsert,
					"trackingFor" | "trackingId"
				>,
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

	const values = [] as (typeof trackerSnapshots.$inferInsert)[];
	const cutoffs = [] as (typeof trackerCutoffs.$inferInsert)[];

	{
		const trackingReference = getTrackingReference(metadata);
		values.push(...ranking.t10.map(toTrackerSnapshot(trackingReference)));
		if (toTrackerCutoff)
			cutoffs.push(...ranking.cutoffs.map(toTrackerCutoff(trackingReference)));
	}

	if (updateMusics) {
		for (const music of ranking.musics!) {
			const trackingReference = {
				trackingFor: "music" as const,
				trackingId: music.id,
			};

			values.push(...music.t10.map(toTrackerSnapshot(trackingReference)));
			cutoffs.push(...music.cutoffs.map(toTrackerCutoff!(trackingReference)));
		}
	}

	const [inserted] = await logger.trace(
		`insert-${metadata.kind}-snapshots`,
		async () => {
			return db().batch([
				db()
					.insert(trackerSnapshots)
					.values(values)
					.onConflictDoNothing()
					.returning({
						uid: trackerSnapshots.uid,
						name: trackerSnapshots.name,
						point: trackerSnapshots.point,
						rank: trackerSnapshots.rank,
						trackingFor: trackerSnapshots.trackingFor,
						trackingId: trackerSnapshots.trackingId,
					}),
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
								}),
						]
					: []),
			]);
		},
	);

	if (inserted.length === 0) return [];

	await tags.add(
		Object.entries(countBy(inserted, ({ trackingFor }) => trackingFor)).map(
			([kind, count]) => `${kind}_+${count}`,
		),
	);

	await logger.trace(`update-${metadata.kind}-redis`, async () => {
		const pipe = redis().pipeline();
		const add = (
			key: string | string[],
			[first, ...rest]: RankingUser[],
			memberKey: "rank" | "userId",
		) => {
			if (!first) return;

			pipe.zadd(
				GBP.fromMetadata(metadata, ...(Array.isArray(key) ? key : [key])),
				{ gt: true },
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

		await pipe.exec();
	});

	return inserted;
};

const sendPushNotifications = async (
	ranking: Ranking,
	{ now, metadata }: InsertSnapshotOptions,
) => {
	if (now.get("minutes") % 10 !== 0) return;

	const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
	if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

	const key = GBP.fromMetadata(metadata, "leaderboard");
	const t15 = await redis()
		.zrange<number[]>(key, 0, 14, { rev: true })
		.then((uids) => uids.map((uid) => uid.toString()));

	const trackingReference = getTrackingReference(metadata);
	const snapshots = await db().query.trackerSnapshots.findMany({
		columns: { uid: true, name: true, point: true, rank: true },
		where: { ...trackingReference, uid: { in: t15 } },
		orderBy: { id: "desc" },
		with: {
			profile: {
				columns: { avatar: true },
				where: { ...trackingReference, avatar: { isNotNull: true } },
			},
		},
	});

	const items = snapshots.map((item) => ({
		...item,
		key: GBP.fromMetadata(metadata, "notify", item.uid),
	}));
	const notifyEntries = await redis().json.mget<NotifyWhenPlayer[][][]>(
		items.map(({ key }) => key),
		"$",
	);

	const t10 = new Set(ranking.t10.map(({ userId }) => userId));
	const payloads = await logger.trace(
		`generate-${metadata.kind}-webpush-payload`,
		async () => {
			const results = await Promise.all(
				items.map(async ({ key, uid, name, point, rank }, idx) => {
					const notify = notifyEntries.at(idx)?.flat();
					if (!notify || notify.length === 0) return [];

					const subscriptions = [...notify.entries()].filter(
						([, { on }]) =>
							on.target === "play-again" ||
							(on.target === "point" && point > on.value) ||
							(on.target === "boated-from" &&
								(rank > on.value || !t10.has(uid))),
					);
					if (subscriptions.length === 0) return [];

					const deleteNotify = redis().multi();
					for (const [idx] of [...subscriptions].reverse())
						deleteNotify.json.del(key, `$[${idx}]`);
					await deleteNotify.exec();

					const profile = await db().query.trackerSnapshotProfiles.findFirst({
						columns: { avatar: true },
						where: { ...trackingReference, uid },
					});

					return uniqBy(
						subscriptions.map(([, it]) => it),
						({ on, subscription }) =>
							`${subscription.endpoint}:${on.target}:${on.value}`,
					).map(({ on, subscription }) => {
						let body = `notify me: ${name}`;
						if (on.target === "play-again") body = `${name} just plays again!`;
						else if (on.target === "point")
							body = `${name} just hit ${formatNumber(point)} Pts!`;
						else if (on.target === "boated-from")
							body = `${name} just got boated from rank #${on.value}!`;

						return {
							subscription,
							tag: `${key}-${on.target}-${on.value}`,
							title: metadata.name,
							body,
							icon: profile?.avatar
								? `/assets/cards/${profile.avatar.id}-${profile.avatar.trained ? "trained" : "normal"}-icon.webp`
								: undefined,
							image: `/assets/tracker/${trackingReference.trackingFor}-${trackingReference.trackingId}-logo.webp`,
							timestamp: now.valueOf(),
							navigate: `/tracker?tab=${trackingReference.trackingFor}&id=${trackingReference.trackingId}`,
						};
					});
				}),
			);

			return results.flat();
		},
	);
	if (payloads.length === 0) return;

	const results = await logger.trace(`send-${metadata.kind}-webpush`, () =>
		Promise.allSettled(
			payloads.map(({ subscription, ...data }) =>
				webPush.sendNotification(subscription, JSON.stringify(data), {
					TTL: Math.max(
						60 * 60 * 12,
						dayjs(metadata.endAt).diff(dayjs(), "seconds"),
					),
					vapidDetails: {
						publicKey: VAPID_PUBLIC_KEY,
						privateKey: VAPID_PRIVATE_KEY,
						subject: "mailto:eh@example.com",
					},
				}),
			),
		),
	);

	const { fulfilled = 0 } = countBy(results, ({ status }) => status);
	if (fulfilled > 0) await tags.add(`notified_${fulfilled}`);
};
