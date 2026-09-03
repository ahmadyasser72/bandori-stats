import {
	idempotencyKeys,
	schedules,
	tags,
	metadata as triggerMetadata,
	wait,
} from "@trigger.dev/sdk";
import { allKeyed, countBy, curry, pick, sumBy, uniqBy } from "es-toolkit";
import webPush from "web-push";

import dayjs from "@bandori-stats/bestdori/date";
import { formatNumber } from "@bandori-stats/bestdori/helpers";
import { db, sql } from "@bandori-stats/database";
import {
	GBP,
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
import { githubRedeploy } from "./github-redeploy";
import { getAvatar, updateTrackerProfile } from "./update-tracker-profile";

export const scheduleUpdateTracker = schedules.task({
	id: "schedule-update-tracker",
	ttl: "1m",
	cron: { pattern: "* * * * *" },
	run: async (context) => {
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

		const now = dayjs(context.timestamp).startOf("minute").add(1, "minute");
		await wait.until({ date: now.toDate() });

		const results = await Promise.allSettled([
			(async () => {
				if (!event || now.isBefore(event.startAt)) return [];
				// @ts-ignore Date is parse-able
				triggerMetadata.set("event", event);

				const {
					points = [],
					cutoffs = [],
					musics,
				} = await (async () => {
					if (event.type === "versus") {
						const data = await bangDream(version, event.type, event.id);
						return {
							points: data.eventPointTopUsers?.entries,
							cutoffs: data.eventPointBorderUsers?.entries,
							musics: data.versusMusicRankings,
						};
					} else if (event.type === "medley") {
						const data = await bangDream(version, event.type, event.id);
						return {
							points: data.eventPointTopUsers?.entries,
							cutoffs: data.eventPointBorderUsers?.entries,
							musics: [
								{
									$typeName: "MusicRankingResponse",
									musicId: event.musics[0].id,
									...pick(data, [
										"scoreBorderUsers",
										"scoreNearUsers",
										"scoreTopUsers",
									]),
								} satisfies MusicRankingResponse,
							],
						};
					} else if (event.type === "challenge") {
						const data = await bangDream(version, event.type, event.id);
						return {
							points: data.eventPointTopUsers?.entries,
							cutoffs: data.eventPointBorderUsers?.entries,
							musics: data.challengeMusicRankings,
						};
					} else if (event.type === "mission_live") {
						const data = await bangDream(version, event.type, event.id);
						return {
							points: data.topUsers?.entries,
							cutoffs: data.borderUsers?.entries,
						};
					} else if (event.type === "live_try" || event.type === "festival") {
						const data = await bangDream(version, event.type, event.id);
						return {
							points: data.topUsers?.entries,
							cutoffs: data.eventPointBorderUsers?.entries,
						};
					}
					// } else if (event.type === "story") {
					// 	// legacy events, skip
					// 	return [];
					// }

					return {};
				})();
				if (points.length === 0 && !musics) return [];

				const top = {
					t10: points,
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

				await updateRedisLeaderboard(top, { metadata });
				await sendPushNotifications(top, { now, inserted, metadata });

				return inserted;
			})(),
			(async () => {
				if (!monthly || now.isBefore(monthly.startAt)) return [];
				// @ts-ignore Date is parse-able
				triggerMetadata.set("monthly", monthly);

				const data = await bangDream(version, "monthly", monthly.id);
				const points = data.monthlyRankingPointTopUsers?.entries ?? [];
				const cutoffs = data.monthlyRankingPointBorderUsers?.entries ?? [];
				if (points.length === 0 || cutoffs.length === 0) return [];

				const top = { t10: points, cutoffs } satisfies Ranking;
				const metadata: GbpMetadata = { kind: "monthly", ...monthly };
				const inserted = await insertSnapshots(top, { now, metadata });
				if (inserted.length === 0) return [];

				await updateRedisLeaderboard(top, { metadata });
				await sendPushNotifications(top, { now, inserted, metadata });

				return inserted;
			})(),
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
			await updateTrackerProfile.triggerAndWait({
				players: inserted.map(({ uid, trackingFor, trackingId }) => ({
					uid,
					trackingReference: { trackingFor, trackingId },
				})),
			});
		}

		const thisHour = dayjs().startOf("hours").unix();
		await githubRedeploy.trigger(undefined, {
			idempotencyKey: await idempotencyKeys.create(
				`redeploy:bandori:${thisHour}`,
				{ scope: "global" },
			),
			idempotencyKeyTTL: "1h",
		});
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
	const toTrackerSnapshot = curry(
		(
			trackingReference: Pick<
				typeof trackerSnapshots.$inferInsert,
				"trackingFor" | "trackingId"
			>,
			{ userId, name, rank, point }: RankingUser,
		): typeof trackerSnapshots.$inferInsert => ({
			...trackingReference,

			uid: userId.toString(),
			name,
			rank,
			point: Number(point),
			timestamp: now.toDate(),
		}),
	);
	const toTrackerCutoff = curry(
		(
			trackingReference: Pick<
				typeof trackerSnapshots.$inferInsert,
				"trackingFor" | "trackingId"
			>,
			{ name, rank, point, userProfileSituation }: RankingUser,
		) =>
			allKeyed({
				...trackingReference,

				name,
				rank,
				point: Number(point),
				timestamp: now.toDate(),
				avatar: getAvatar({ userProfileSituation }),
			}),
	);

	const { points, musics } = await allKeyed({
		points: (async () => {
			const trackingReference = getTrackingReference(metadata);
			return {
				values: ranking.t10.map(toTrackerSnapshot(trackingReference)),
				cutoffs: await Promise.all(
					ranking.cutoffs.map(toTrackerCutoff(trackingReference)),
				),
			};
		})(),
		musics: (async () => {
			if (
				metadata.kind !== "event" ||
				metadata.musics.length === 0 ||
				!ranking.musics
			)
				return { values: [], cutoffs: [] };

			const trackingReference = (id: number) => ({
				trackingFor: "music" as const,
				trackingId: id,
			});

			return {
				values: ranking.musics.flatMap(({ id, t10 }) =>
					t10.map(toTrackerSnapshot(trackingReference(id))),
				),
				cutoffs: await Promise.all(
					ranking.musics.flatMap(({ id, cutoffs }) =>
						cutoffs.map(toTrackerCutoff(trackingReference(id))),
					),
				),
			};
		})(),
	});

	const [inserted] = await db().batch([
		db()
			.insert(trackerSnapshots)
			.values([...musics.values, ...points.values])
			.onConflictDoNothing()
			.returning({
				uid: trackerSnapshots.uid,
				name: trackerSnapshots.name,
				point: trackerSnapshots.point,
				rank: trackerSnapshots.rank,
				trackingFor: trackerSnapshots.trackingFor,
				trackingId: trackerSnapshots.trackingId,
			}),
		db()
			.insert(trackerCutoffs)
			.values([...musics.cutoffs, ...points.cutoffs])
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
	]);

	if (inserted.length > 0) {
		await tags.add(
			Object.entries(countBy(inserted, ({ trackingFor }) => trackingFor)).map(
				([kind, count]) => `${kind}_+${count}`,
			),
		);
	}

	return inserted;
};

interface UpdateRedisLeaderboardOptions {
	metadata: GbpMetadata;
}

const updateRedisLeaderboard = async (
	ranking: Ranking,
	{ metadata }: UpdateRedisLeaderboardOptions,
) => {
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
			{ member: first[memberKey].toString(), score: Number(first.point) },
			...rest.map((it) => ({
				member: it[memberKey].toString(),
				score: Number(it.point),
			})),
		);
	};

	add("leaderboard", ranking.t10, "userId");
	add("cutoffs", ranking.cutoffs, "rank");

	if (
		metadata.kind === "event" &&
		metadata.musics.length > 0 &&
		ranking.musics
	) {
		for (const { id, t10, cutoffs } of ranking.musics) {
			const musicId = metadata.type === "medley" ? "medley" : id.toString();
			add(["leaderboard-music", musicId], t10, "userId");
			add(["cutoffs-music", musicId], cutoffs, "rank");
		}
	}

	await pipe.exec();
};

interface SendPushNotificationOptions {
	now: dayjs.Dayjs;
	inserted: Awaited<ReturnType<typeof insertSnapshots>>;
	metadata: GbpMetadata;
}

const sendPushNotifications = async (
	ranking: Ranking,
	{ now, inserted, metadata }: SendPushNotificationOptions,
) => {
	const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
	if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

	const trackingReference = getTrackingReference(metadata);

	const top10ByUid = new Map(
		ranking.t10.map((data) => [data.userId.toString(), data]),
	);

	const formerTop10 = [] as typeof inserted;
	const updatedTop10 = !!inserted.find(({ rank }) => rank === 10);
	if (updatedTop10) {
		const key = GBP.fromMetadata(metadata, "leaderboard");
		const outsideTop10 = await redis()
			.zrange<number[]>(key, 10, -1, { rev: true })
			.then((uids) => uids.map((uid) => uid.toString()));
		if (outsideTop10.length > 0) {
			const latestSnapshots = await Promise.all(
				outsideTop10.map((uid) =>
					db().query.trackerSnapshots.findFirst({
						columns: { uid: true, name: true, point: true, rank: true },
						where: { ...trackingReference, uid },
						orderBy: { id: "desc" },
					}),
				),
			);

			for (const snapshot of latestSnapshots) {
				if (snapshot) formerTop10.push({ ...snapshot, ...trackingReference });
			}
		}
	}

	const items = [...inserted, ...formerTop10].map((item) => ({
		...item,
		key: GBP.fromMetadata(metadata, "notify", item.uid),
	}));
	const notifyEntries = await redis().json.mget<NotifyWhenPlayer[][][]>(
		items.map(({ key }) => key),
		"$",
	);

	const payloads = await Promise.all(
		items.map(async ({ key, uid, name, point, rank }, idx) => {
			const notify = notifyEntries.at(idx)?.flat();
			if (!notify || notify.length === 0) return [];

			const subscriptions = [...notify.entries()].filter(
				([, { on }]) =>
					on.target === "play-again" ||
					(on.target === "point" && point > on.value) ||
					(on.target === "boated-from" &&
						(rank > on.value || !top10ByUid.has(uid))),
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
	).then((payloads) => payloads.flat());
	if (payloads.length === 0) return;

	const results = await Promise.allSettled(
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
	);

	const notificationSent = sumBy(results, ({ status }) =>
		status === "fulfilled" ? 1 : 0,
	);
	if (notificationSent > 0) await tags.add(`notified_${notificationSent}`);
};
