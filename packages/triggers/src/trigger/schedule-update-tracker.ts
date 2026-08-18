import { schedules, tags } from "@trigger.dev/sdk";
import webPush from "web-push";
import type z from "zod";

import dayjs from "@bandori-stats/bestdori/date";
import { formatNumber, uniqBy } from "@bandori-stats/bestdori/helpers";
import type {
	GameEvent,
	GameMonthlyRanking,
} from "@bandori-stats/bestdori/schema/misc";
import { db } from "@bandori-stats/database";
import {
	GBP,
	redis,
	type NotifyWhenPlayer,
} from "@bandori-stats/database/redis";
import {
	trackerSnapshots,
	type GbpMetadata,
} from "@bandori-stats/database/schema";
import { bangDream } from "~/bang-dream-gbp/fetch";
import type { RankingUser } from "~/bang-dream-gbp/gen/common_pb";
import { updateTrackerProfile } from "./update-tracker-profile";

export const scheduleUpdateTracker = schedules.task({
	id: "schedule-update-tracker",
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
		>(GBP.version, GBP.event.current, GBP.monthly.current);

		await tags.add(`version_${version ?? "n/a"}`);
		if (!version) return;

		await Promise.all([
			(async () => {
				if (!event) {
					await tags.add("event_n/a");
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
				if (inserted.length === 0) return;

				await Promise.all([
					updateRedis(top, { inserted, metadata }),
					sendPushNotifications(top, { inserted, metadata }),
				]);
			})(),
			(async () => {
				if (!monthly) {
					await tags.add("monthly_n/a");
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
				if (inserted.length === 0) return;

				await Promise.all([
					updateRedis(top, { inserted, metadata }),
					sendPushNotifications(top, { inserted, metadata }),
				]);
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
		await updateTrackerProfile.trigger({
			uid: top10[0].userId.toString(),
			next: top10.slice(1).map(({ userId }) => userId.toString()),
			trackingReference,
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

const getRedisKey = (metadata: GbpMetadata) =>
	GBP[metadata.kind][
		metadata.kind === "event" ? metadata.eventId : metadata.monthlyRankingId
	];
