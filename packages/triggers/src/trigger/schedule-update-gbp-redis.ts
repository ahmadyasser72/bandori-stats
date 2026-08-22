import { schedules, tags } from "@trigger.dev/sdk";

import { GBP_TIMEZONE } from "@bandori-stats/bestdori/constants";
import dayjs from "@bandori-stats/bestdori/date";
import { MasterDB, Versions } from "@bandori-stats/bestdori/schema/misc";
import { db } from "@bandori-stats/database";
import { GBP, redis } from "@bandori-stats/database/redis";
import { gbpEvents, gbpMonthlyRankings } from "@bandori-stats/database/schema";
import { bestdori } from "~/bestdori";

export const scheduleUpdateGbpRedis = schedules.task({
	id: "schedule-update-gbp-redis",
	cron: {
		pattern: "0 */12 * * *",
		timezone: GBP_TIMEZONE,
	},
	run: async () => {
		const [currentVersion, currentEvent, currentMonthly, areaItems] =
			await redis().mget<(unknown | null)[]>(
				GBP.version,
				GBP.event.current,
				GBP.monthly.current,
				GBP.areaItems,
			);

		const pipe = redis().pipeline();
		pipe.get(GBP.version);

		{
			const versions = await bestdori({
				path: "api/Versions_en.json",
				schema: Versions,
			});
			if (currentVersion !== versions.app) {
				pipe.set(GBP.version, versions.app);
				await tags.add(`version_${versions.app}`);
			}
		}

		if (!currentEvent || !currentMonthly || !areaItems) {
			const data = await bestdori({
				path: "api/MasterDB_en.json",
				schema: MasterDB,
			});

			const events = Object.values(data.masterEventMap.entries);
			if (!currentEvent && events.length > 0) {
				for (const event of events) {
					if (dayjs().isAfter(event.endAt)) continue;

					pipe.set(GBP.event.current, event, { pxat: event.endAt });
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
					pipe.set(GBP.event.current, active, { pxat: active.endAt });
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

			if (!areaItems)
				pipe.json.set(GBP.areaItems, "$", data.masterAreaItemMap.entries);
		}

		await pipe.exec();
	},
});
