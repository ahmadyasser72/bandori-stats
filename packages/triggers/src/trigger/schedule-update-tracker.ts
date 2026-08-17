import { AbortTaskRunError, schedules, tags } from "@trigger.dev/sdk";
import webPush from "web-push";
import type z from "zod";

import dayjs from "@bandori-stats/bestdori/date";
import { formatNumber, uniqBy } from "@bandori-stats/bestdori/helpers";
import type {
	GameEvent,
	GameMonthlyRanking,
} from "@bandori-stats/bestdori/schema/misc";
import { db, sql } from "@bandori-stats/database";
import {
	GAME_EVENT_CURRENT,
	GAME_MONTHLY_CURRENT,
	GAME_VERSION,
	redis,
	type NotifyWhenPlayer,
} from "@bandori-stats/database/redis";
import {
	trackerSnapshotProfiles,
	trackerSnapshots,
	type GbpMetadata,
	type PlayerBandMember,
} from "@bandori-stats/database/schema";
import { bangDream } from "~/bang-dream-gbp/fetch";
import type {
	RankingUser,
	UserSituationList,
} from "~/bang-dream-gbp/gen/common_pb";

export const scheduleUpdateTracker = schedules.task({
	id: "schedule-update-tracker",
	machine: { preset: "small-1x" },
	ttl: "1m",
	cron: { pattern: "* * * * *" },
	run: async (context) => {
		const now = dayjs(context.timestamp).startOf("minute");

		const [version, event, monthly] = await redis().mget<
			[
				string | null,
				z.infer<typeof GameEvent> | null,
				z.infer<typeof GameMonthlyRanking> | null,
			]
		>(GAME_VERSION, GAME_EVENT_CURRENT, GAME_MONTHLY_CURRENT);

		if (!version)
			throw new AbortTaskRunError(`${GAME_VERSION} is not defined.`);

		await Promise.all([
			(async () => {
				if (!event) {
					await tags.add("no_event");
					return;
				}

				const { eventId, eventType } = event;
				const top = await (async () => {
					if (
						eventType === "versus" ||
						eventType === "challenge" ||
						eventType === "medley"
					) {
						const data = await bangDream(version, eventType, eventId);
						data;
						return data.eventPointTopUsers?.entries ?? [];
					} else if (
						eventType === "mission_live" ||
						eventType === "live_try" ||
						eventType === "festival"
					) {
						const data = await bangDream(version, eventType, eventId);
						return data.topUsers?.entries ?? [];
					}
					// } else if (eventType === "story") {
					// 	// legacy events, skip
					// 	return [];
					// }

					return [];
				})();
				if (top.length === 0) return;

				const metadata = { kind: "event", ...event } as unknown as GbpMetadata;

				const inserted = await insertSnapshots(top, { now, metadata });

				if (inserted.length > 0) {
					await Promise.all([
						updateRedis(top, { inserted, metadata }),
						sendPushNotifications(top, { inserted, metadata }),
					]);
				}
			})(),
			(async () => {
				if (!monthly) {
					await tags.add("no_monthly");
					return;
				}

				const { monthlyRankingId } = monthly;
				const data = await bangDream(version, "monthly", monthlyRankingId);
				const top = data.monthlyRankingPointTopUsers?.entries ?? [];
				if (top.length === 0) return;

				const metadata = {
					kind: "monthly",
					...monthly,
				} as unknown as GbpMetadata;
				const inserted = await insertSnapshots(top, { now, metadata });

				if (inserted.length > 0) {
					await Promise.all([
						updateRedis(top, { inserted, metadata }),
						sendPushNotifications(top, { inserted, metadata }),
					]);
				}
			})(),
		]);
	},
});

interface InsertSnapshotOptions {
	now: dayjs.Dayjs;
	metadata: GbpMetadata;
}

const insertSnapshots = async (
	top10: RankingUser[],
	{ now, metadata }: InsertSnapshotOptions,
) => {
	const trackingReference = {
		trackingFor: metadata.kind,
		trackingId:
			metadata.kind === "event" ? metadata.eventId : metadata.monthlyRankingId,
	};

	if (now.get("minutes") === 0) {
		const getBandMember = (
			list: UserSituationList,
			idx: number,
		): PlayerBandMember | null => {
			const data = list.entries?.at(idx);
			if (!data) return null;

			return {
				id: data.situationId,
				level: data.level,
				skillLevel: data.skillLevel,
				illust: data.illust as PlayerBandMember["illust"],
			};
		};

		const values = top10.map(
			({
				userId,
				name,
				rankLevel,
				introduction,
				userProfileSituation,
				userDeck,
				userSituationList,
				userProfileDegreeMap,
			}): typeof trackerSnapshotProfiles.$inferInsert => ({
				...trackingReference,

				uid: userId.toString(),
				name: name,
				level: rankLevel,
				introduction: introduction,

				avatar:
					userProfileSituation &&
					"situationId" in userProfileSituation &&
					"illust" in userProfileSituation
						? {
								id: userProfileSituation.situationId,
								illust: userProfileSituation.illust,
							}
						: null,

				band: {
					name: userDeck?.deckName!,
					center: getBandMember(userSituationList!, 0),
					members: [
						getBandMember(userSituationList!, 1),
						getBandMember(userSituationList!, 2),
						getBandMember(userSituationList!, 3),
						getBandMember(userSituationList!, 4),
					],
				},

				titles: {
					first: userProfileDegreeMap?.entries?.first?.degreeId ?? null,
					second: userProfileDegreeMap?.entries?.second?.degreeId ?? null,
				},
			}),
		);
		await db()
			.insert(trackerSnapshotProfiles)
			.values(values)
			.onConflictDoUpdate({
				target: [
					trackerSnapshotProfiles.uid,
					trackerSnapshotProfiles.trackingFor,
					trackerSnapshotProfiles.trackingId,
				],
				set: {
					name: sql.raw(`excluded.${trackerSnapshotProfiles.name.name}`),
					level: sql.raw(`excluded.${trackerSnapshotProfiles.level.name}`),
					introduction: sql.raw(
						`excluded.${trackerSnapshotProfiles.introduction.name}`,
					),
					avatar: sql.raw(`excluded.${trackerSnapshotProfiles.avatar.name}`),
					band: sql.raw(`excluded.${trackerSnapshotProfiles.band.name}`),
					titles: sql.raw(`excluded.${trackerSnapshotProfiles.titles.name}`),
				},
			});
	}

	const values = top10.map(
		({ userId, name, rank, point }): typeof trackerSnapshots.$inferInsert => ({
			...trackingReference,

			uid: userId.toString(),
			name,
			rank,
			point: Number(point),
			timestamp: now.toDate(),
		}),
	);
	return db()
		.insert(trackerSnapshots)
		.values(values)
		.onConflictDoNothing()
		.returning({
			uid: trackerSnapshots.uid,
			name: trackerSnapshots.name,
			point: trackerSnapshots.point,
			rank: trackerSnapshots.rank,
		});
};

interface UpdateRedisTop10Options {
	inserted: Awaited<ReturnType<typeof insertSnapshots>>;
	metadata: GbpMetadata;
}

const updateRedis = async (
	top10: RankingUser[],
	{ inserted, metadata }: UpdateRedisTop10Options,
) => {
	const key = getRedisKey(metadata);
	await redis().mset(
		Object.fromEntries(
			top10.map(({ userId, rank }) => [`${key}:${rank}`, userId!.toString()]),
		),
	);
	await tags.add([
		`${metadata.kind}_${metadata.assetBundleName}`,
		`${metadata.kind}_+${inserted.length}`,
	]);

	const uids = top10.map(({ userId }) => userId!.toString());
	// @ts-expect-error should works
	const newTop10 = await redis().sadd(`${key}:players`, ...uids);
	if (newTop10 > 0) await tags.add(`${metadata.kind}_player+${newTop10}`);
};

interface SendPushNotificationOptions {
	inserted: Awaited<ReturnType<typeof insertSnapshots>>;
	metadata: GbpMetadata;
}

const sendPushNotifications = async (
	top10: RankingUser[],
	{ inserted, metadata }: SendPushNotificationOptions,
) => {
	const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
	if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

	const baseKey = getRedisKey(metadata);
	const top10ByUid = new Map(
		top10.map((data) => [data.userId.toString(), data]),
	);

	const formerTop10 = [] as typeof inserted;
	const newTop10 = !!inserted.find(({ rank }) => rank === 10);
	if (newTop10) {
		const outsideTop10 = (
			await redis().smembers<number[]>(`${baseKey}:players`)
		)
			.map((uid) => uid.toString())
			.filter((uid) => !top10ByUid.has(uid));

		if (outsideTop10.length > 0) {
			const latestSnapshots = await Promise.all(
				outsideTop10.map((uid) =>
					db().query.trackerSnapshots.findFirst({
						columns: { uid: true, name: true, point: true, rank: true },
						where: {
							trackingFor: metadata.kind,
							trackingId:
								metadata.kind === "event"
									? metadata.eventId
									: metadata.monthlyRankingId,
							uid,
						},
						orderBy: { id: "desc" },
					}),
				),
			);

			for (const snapshot of latestSnapshots) {
				if (snapshot) formerTop10.push(snapshot);
			}
		}
	}

	const payloads = await Promise.all(
		[...inserted, ...formerTop10].map(async ({ uid, name, point, rank }) => {
			const key = `${baseKey}:notify:${uid}`;
			const notify = await redis().json.get<NotifyWhenPlayer[][]>(key, "$");
			if (!notify) return [];

			const subscriptions = [...notify.flat().entries()].filter(
				([, { on }]) =>
					(on.target === "point" && point > on.value) ||
					(on.target === "boated-from" &&
						(rank > on.value || !top10ByUid.has(uid))),
			);
			if (subscriptions.length === 0) return [];

			const deleteNotify = redis().multi();
			for (const [idx] of [...subscriptions].reverse())
				deleteNotify.json.del(key, `$[${idx}]`);
			await deleteNotify.exec();

			return uniqBy(
				subscriptions.map(([, it]) => it),
				({ on, subscription }) =>
					`${subscription.endpoint}:${on.target}:${on.value}`,
			).map(({ on, subscription }) => {
				return {
					subscription,
					id: `${key}-${on.target}-${on.value}`,
					title:
						metadata.kind === "event"
							? metadata.eventName
							: metadata.monthlyRankingName,
					body:
						on.target === "point"
							? `${name} just hit ${formatNumber(point)} Pts!`
							: `${name} just got boated from rank #${on.value}!`,
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

	let notificationSent = 0;
	for (const result of results) {
		if (result.status === "rejected") console.error(result.reason);
		else notificationSent += 1;
	}

	if (notificationSent > 0) await tags.add(`notified_${notificationSent}`);
};

const getRedisKey = (metadata: GbpMetadata) => {
	const base =
		metadata.kind === "event" ? GAME_EVENT_CURRENT : GAME_MONTHLY_CURRENT;
	const id =
		metadata.kind === "event" ? metadata.eventId : metadata.monthlyRankingId;

	return base.replace("current", id.toString());
};
