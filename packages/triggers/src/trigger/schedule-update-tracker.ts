import { idempotencyKeys, schedules, tags, wait } from "@trigger.dev/sdk";
import { allKeyed, sumBy, uniqBy } from "es-toolkit";
import webPush from "web-push";

import dayjs from "@bandori-stats/bestdori/date";
import { formatNumber } from "@bandori-stats/bestdori/helpers";
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
import { getTrackingReference } from "@bandori-stats/database/tracker";
import { bangDream } from "~/bang-dream-gbp/fetch";
import type { RankingUser } from "~/bang-dream-gbp/gen/common_pb";
import { discordTracker } from "./discord-tracker";
import { githubRedeploy } from "./github-redeploy";
import { updateTrackerProfile } from "./update-tracker-profile";

export const scheduleUpdateTracker = schedules.task({
	id: "schedule-update-tracker",
	ttl: "1m",
	cron: { pattern: "* * * * *" },
	run: async (context) => {
		const [version, eventId, monthlyId] = await redis().mget<
			[string | null, number | null, number | null]
		>(GBP.version, GBP.event.current, GBP.monthly.current);

		await tags.add(`version_${version ?? "n/a"}`);
		if (!version) return;

		const { event, monthly } = await allKeyed({
			event:
				eventId && db().query.gbpEvents.findFirst({ where: { id: eventId } }),
			monthly:
				monthlyId &&
				db().query.gbpMonthlyRankings.findFirst({ where: { id: monthlyId } }),
		});

		const now = dayjs(context.timestamp).startOf("minute").add(1, "minute");
		await wait.until({ date: now.toDate() });

		const results = await Promise.allSettled([
			(async () => {
				if (!event || now.isBefore(event.startAt)) return [];

				const top = await (async () => {
					if (
						event.type === "versus" ||
						event.type === "challenge" ||
						event.type === "medley"
					) {
						const data = await bangDream(version, event.type, event.id);
						return data.eventPointTopUsers?.entries ?? [];
					} else if (
						event.type === "mission_live" ||
						event.type === "live_try" ||
						event.type === "festival"
					) {
						const data = await bangDream(version, event.type, event.id);
						return data.topUsers?.entries ?? [];
					}
					// } else if (event.type === "story") {
					// 	// legacy events, skip
					// 	return [];
					// }

					return [];
				})();
				if (top.length === 0) return [];

				const metadata: GbpMetadata = { kind: "event", ...event };
				const inserted = await insertSnapshots(top, { now, metadata });
				if (inserted.length === 0) return [];

				await Promise.all([
					tags.add(`${metadata.kind}_+${inserted.length}`),
					updateRedisLeaderboard(top, { metadata }),
					sendPushNotifications(top, { now, inserted, metadata }),
				]);

				return inserted.map(({ uid }) => ({ uid, metadata }));
			})(),
			(async () => {
				if (!monthly || now.isBefore(monthly.startAt)) return [];

				const data = await bangDream(version, "monthly", monthly.id);
				const top = data.monthlyRankingPointTopUsers?.entries ?? [];
				if (top.length === 0) return [];

				const metadata: GbpMetadata = { kind: "monthly", ...monthly };
				const inserted = await insertSnapshots(top, { now, metadata });
				if (inserted.length === 0) return [];

				await Promise.all([
					tags.add(`${metadata.kind}_+${inserted.length}`),
					updateRedisLeaderboard(top, { metadata }),
					sendPushNotifications(top, { now, inserted, metadata }),
				]);

				return inserted.map(({ uid }) => ({ uid, metadata }));
			})(),
		]);

		if (now.get("minutes") === 59) {
			const metadatas = [] as GbpMetadata[];
			if (event) metadatas.push({ kind: "event", ...event });
			if (monthly) metadatas.push({ kind: "monthly", ...monthly });

			if (metadatas.length > 0) await discordTracker.trigger({ metadatas });
		}

		const errors = results.filter((promise) => promise.status === "rejected");
		for (const { reason } of errors) console.error(reason);

		const inserted = results
			.filter((promise) => promise.status === "fulfilled")
			.flatMap<{ uid: string; metadata: GbpMetadata }>(({ value }) => value);

		if (inserted.length > 0) {
			await updateTrackerProfile.triggerAndWait({
				players: inserted.map(({ uid, metadata }) => ({
					uid,
					trackingReference: getTrackingReference(metadata),
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

interface InsertSnapshotOptions {
	now: dayjs.Dayjs;
	metadata: GbpMetadata;
}

const insertSnapshots = async (
	top10: RankingUser[],
	{ now, metadata }: InsertSnapshotOptions,
) => {
	const trackingReference = getTrackingReference(metadata);
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

interface UpdateRedisLeaderboardOptions {
	metadata: GbpMetadata;
}

const updateRedisLeaderboard = async (
	top10: RankingUser[],
	{ metadata }: UpdateRedisLeaderboardOptions,
) => {
	const key = GBP.fromMetadata(metadata, "leaderboard");
	await redis().zadd(
		key,
		{ gt: true },
		{ member: top10[0].userId.toString(), score: Number(top10[0].point) },
		...top10.slice(1).map(({ userId, point }) => ({
			member: userId.toString(),
			score: Number(point),
		})),
	);
};

interface SendPushNotificationOptions {
	now: dayjs.Dayjs;
	inserted: Awaited<ReturnType<typeof insertSnapshots>>;
	metadata: GbpMetadata;
}

const sendPushNotifications = async (
	top10: RankingUser[],
	{ now, inserted, metadata }: SendPushNotificationOptions,
) => {
	const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
	if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

	const trackingReference = getTrackingReference(metadata);

	const top10ByUid = new Map(
		top10.map((data) => [data.userId.toString(), data]),
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
				if (snapshot) formerTop10.push(snapshot);
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
