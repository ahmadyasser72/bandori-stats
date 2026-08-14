import { AbortTaskRunError, schedules, tags } from "@trigger.dev/sdk";
import type z from "zod";

import dayjs from "@bandori-stats/bestdori/date";
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
} from "@bandori-stats/database/redis";
import { trackerSnapshots } from "@bandori-stats/database/schema";
import { bangDream } from "~/bang-dream-gbp/fetch";

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

				const { eventId, eventType, assetBundleName } = event;
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

				const inserted = await db()
					.insert(trackerSnapshots)
					.values(
						top.map(({ userId, name, rank, point }) => ({
							trackingFor: "event" as const,
							trackingId: eventId,
							uid: userId?.toString()!,
							name: name!,
							rank: rank!,
							point: point!,
							timestamp: now.toDate(),
						})),
					)
					.onConflictDoNothing()
					.returning({ id: trackerSnapshots.id });

				if (inserted.length > 0) {
					await redis().mset(
						Object.fromEntries(
							top.map(({ userId, rank }) => [
								`${GAME_EVENT_CURRENT.replace("current", event.eventId.toString())}:${rank}`,
								userId?.toString(),
							]),
						),
					);
					await tags.add([
						`event_${assetBundleName}`,
						`event_+${inserted.length}`,
					]);
				}
			})(),
			(async () => {
				if (!monthly) {
					await tags.add("no_monthly");
					return;
				}

				const { monthlyRankingId, assetBundleName } = monthly;
				const data = await bangDream(version, "monthly", monthlyRankingId);
				const top = data.monthlyRankingPointTopUsers?.entries ?? [];
				if (top.length === 0) return;

				const inserted = await db()
					.insert(trackerSnapshots)
					.values(
						top.map(({ userId, name, rank, point }) => ({
							trackingFor: "monthly" as const,
							trackingId: monthlyRankingId,
							uid: userId?.toString()!,
							name: name!,
							rank: rank!,
							point: point!,
							timestamp: now.toDate(),
						})),
					)
					.onConflictDoNothing()
					.returning({ id: trackerSnapshots.id });

				if (inserted.length > 0) {
					await redis().mset(
						Object.fromEntries(
							top.map(({ userId, rank }) => [
								`${GAME_MONTHLY_CURRENT.replace("current", monthly.monthlyRankingId.toString())}:${rank}`,
								userId?.toString(),
							]),
						),
					);
					await tags.add([
						`monthly_${assetBundleName}`,
						`monthly_+${inserted.length}`,
					]);
				}
			})(),
		]);
	},
});
