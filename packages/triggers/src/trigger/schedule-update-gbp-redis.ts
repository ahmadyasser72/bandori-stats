import { AbortTaskRunError, schedules, tags } from "@trigger.dev/sdk";

import { GBP_TIMEZONE } from "@bandori-stats/bestdori/constants";
import dayjs from "@bandori-stats/bestdori/date";
import { MasterDB, Versions } from "@bandori-stats/bestdori/schema/misc";
import { db } from "@bandori-stats/database";
import {
	GAME_EVENT_CURRENT,
	GAME_MONTHLY_CURRENT,
	GAME_VERSION,
	redis,
} from "@bandori-stats/database/redis";
import { gbpEvents, gbpMonthlyRankings } from "@bandori-stats/database/schema";
import { bestdori } from "~/bestdori";

export const scheduleUpdateGbpRedis = schedules.task({
	id: "schedule-update-gbp-redis",
	machine: { preset: "small-2x" },
	cron: {
		pattern: "0 */12 * * *",
		timezone: GBP_TIMEZONE,
	},
	run: async () => {
		const [currentVersion, currentEvent, currentMonthly] = await redis().mget<
			string[]
		>(GAME_VERSION, GAME_EVENT_CURRENT, GAME_MONTHLY_CURRENT);

		const pipe = redis().pipeline();

		{
			const { success, data, error } = Versions.safeParse(
				await bestdori("api/Versions_en.json", {}),
			);

			if (!success) {
				await tags.add("schema_error");
				throw new AbortTaskRunError(error.message);
			}

			if (currentVersion !== data.app) {
				pipe.set(GAME_VERSION, data.app);
				await tags.add(`version_${data.app}`);
			}
		}

		if (!currentEvent || !currentMonthly) {
			const { success, data, error } = MasterDB.safeParse(
				await bestdori("api/MasterDB_en.json", {}),
			);

			if (!success) {
				await tags.add("schema_error");
				throw new AbortTaskRunError(error.message);
			}

			const events = Object.values(data.masterEventMap.entries);
			if (!currentEvent && events.length > 0) {
				for (const event of events) {
					if (dayjs().isAfter(event.endAt)) continue;

					pipe.set(GAME_EVENT_CURRENT, event, { pxat: event.endAt });
					await db()
						.insert(gbpEvents)
						.values({
							...event,
							startAt: new Date(event.startAt),
							endAt: new Date(event.endAt),
						});

					await tags.add(`event_${event.assetBundleName}`);
				}
			}

			if (!currentMonthly) {
				const active = data.masterMonthlyRankingList.entries.find(
					({ startAt, endAt }) => dayjs().isBetween(startAt, endAt),
				);
				if (active) {
					pipe.set(GAME_MONTHLY_CURRENT, active, { pxat: active.endAt });
					await db()
						.insert(gbpMonthlyRankings)
						.values({
							...active,
							startAt: new Date(active.startAt),
							endAt: new Date(active.endAt),
						});

					await tags.add(`monthly_${active.assetBundleName}`);
				}
			}
		}

		await pipe.exec();
	},
});
