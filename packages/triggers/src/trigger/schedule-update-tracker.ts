import { AbortTaskRunError, schedules, tags } from "@trigger.dev/sdk";
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
	GAME_EVENT_CURRENT,
	GAME_MONTHLY_CURRENT,
	GAME_VERSION,
	redis,
	type NotifyWhenPlayer,
} from "@bandori-stats/database/redis";
import {
	trackerSnapshots,
	type GbpMetadata,
} from "@bandori-stats/database/schema";
import { bangDream } from "~/bang-dream-gbp/fetch";
import type { RankingUser } from "~/bang-dream-gbp/proto/event-mission_live.proto";

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

				const meta = { kind: "event", ...event } as unknown as GbpMetadata;
				const inserted = await insertSnapshots(top, { now, meta });

				if (inserted.length > 0) {
					await Promise.all([
						updateRedisTop10(top, { inserted, meta }),
						sendPushNotifications(inserted, { meta }),
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

				const meta = { kind: "monthly", ...monthly } as unknown as GbpMetadata;
				const inserted = await insertSnapshots(top, { now, meta });

				if (inserted.length > 0) {
					await Promise.all([
						updateRedisTop10(top, { inserted, meta }),
						sendPushNotifications(inserted, { meta }),
					]);
				}
			})(),
		]);
	},
});

interface InsertSnapshotOptions {
	now: dayjs.Dayjs;
	meta: GbpMetadata;
}

const insertSnapshots = (
	snapshots: RankingUser.$Shape[],
	{ now, meta }: InsertSnapshotOptions,
) =>
	db()
		.insert(trackerSnapshots)
		.values(
			snapshots.map(({ userId, name, rank, point }) => ({
				trackingFor: meta.kind,
				trackingId:
					meta.kind === "event" ? meta.eventId : meta.monthlyRankingId,
				uid: userId?.toString()!,
				name: name!,
				rank: rank!,
				point: point!,
				timestamp: now.toDate(),
			})),
		)
		.onConflictDoNothing()
		.returning({
			uid: trackerSnapshots.uid,
			name: trackerSnapshots.name,
			point: trackerSnapshots.point,
		});

interface UpdateRedisTop10Options {
	inserted: Awaited<ReturnType<typeof insertSnapshots>>;
	meta: GbpMetadata;
}

const updateRedisTop10 = async (
	snapshots: RankingUser.$Shape[],
	{ inserted, meta }: UpdateRedisTop10Options,
) => {
	const key = getRedisKey(meta);
	await redis().mset(
		Object.fromEntries(
			snapshots.map(({ userId, rank }) => [`${key}:${rank}`, userId]),
		),
	);
	await tags.add([
		`${meta.kind}_${meta.assetBundleName}`,
		`${meta.kind}_+${inserted.length}`,
	]);
};

interface SendPushNotificationOptions {
	meta: GbpMetadata;
}

const sendPushNotifications = async (
	inserted: Awaited<ReturnType<typeof insertSnapshots>>,
	{ meta }: SendPushNotificationOptions,
) => {
	const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
	if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

	const baseKey = getRedisKey(meta);
	const payloads = await Promise.all(
		inserted.map(async ({ uid, name, point }) => {
			const key = `${baseKey}:point:${uid}`;
			const notify = await redis().json.get<NotifyWhenPlayer>(key);
			if (
				!notify ||
				point < notify.when.point ||
				notify.subscriptions.length === 0
			)
				return [];

			await redis().del(key);
			const title =
				meta.kind === "event" ? meta.eventName : meta.monthlyRankingName;
			return uniqBy(notify.subscriptions, ({ endpoint }) => endpoint).map(
				(subscription) => ({
					subscription,
					id: `${key}-${notify.when.point}`,
					title: `${meta.kind}: ${title}`,
					body: `${name} just hit ${formatNumber(point)} Pts!`,
				}),
			);
		}),
	).then((payloads) => payloads.flat());
	if (payloads.length === 0) return;

	await Promise.all(
		payloads.map(({ subscription, ...data }) =>
			webPush.sendNotification(subscription, JSON.stringify(data), {
				TTL: Math.max(60 * 60 * 12, dayjs(meta.endAt).diff(dayjs(), "seconds")),
				topic: data.id,
				vapidDetails: {
					publicKey: VAPID_PUBLIC_KEY,
					privateKey: VAPID_PRIVATE_KEY,
					subject: "mailto:eh@example.com",
				},
			}),
		),
	);
};

const getRedisKey = (meta: GbpMetadata) => {
	const base =
		meta.kind === "event" ? GAME_EVENT_CURRENT : GAME_MONTHLY_CURRENT;
	const id = meta.kind === "event" ? meta.eventId : meta.monthlyRankingId;

	return base.replace("current", id.toString());
};
