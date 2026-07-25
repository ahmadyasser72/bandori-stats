import { GBP_TIMEZONE } from "@bandori-stats/bestdori/constants";
import dayjs from "@bandori-stats/bestdori/date";
import { db } from "@bandori-stats/database";

import { schedules } from "@trigger.dev/sdk";
import { createShuffle } from "fast-shuffle";

import { updateProfile } from "./update-profile";
import { updateStats } from "./update-stats";

export const scheduleUpdateSnapshots = schedules.task({
	id: "schedule-update-snapshots",
	cron: {
		pattern: "5 0 * * *",
		timezone: GBP_TIMEZONE,
	},
	run: async (context) => {
		const now = dayjs.tz(context.timestamp, GBP_TIMEZONE);
		const date = now.startOf("day").format("YYYY-MM-DD");

		const shuffle = createShuffle(now.unix());
		const accounts = await db()
			.query.accounts.findMany({
				columns: { id: true, username: true, lastUpdated: true },
				where: { disabledAt: { isNull: true } },
			})
			.then((accounts) =>
				shuffle(accounts)
					.map((account, idx) => ({ ...account, idx }))
					.filter((account) => {
						if (account.lastUpdated === null) return true;

						const lastUpdated = dayjs(account.lastUpdated);
						const isRecentlyUpdated = now.diff(lastUpdated, "weeks") < 2;
						const daysSinceUpdate = now.diff(lastUpdated, "days");
						const jitter = account.id % 7;

						return isRecentlyUpdated || daysSinceUpdate >= 7 + jitter;
					}),
			);

		const TOTAL_MINUTES = 24 * 60 - 10;
		const slot = TOTAL_MINUTES / accounts.length;
		const payloads: Parameters<typeof updateStats.batchTrigger>[0] =
			accounts.map(({ username, idx }) => ({
				payload: { username, date },
				options: {
					delay: now
						.add(Math.floor(idx * slot + Math.random() * slot), "minutes")
						.toDate(),
					tags: `@_${username}`,
				},
			}));

		const maxBatchSize = 1000;
		for (let idx = 0; idx < payloads.length; idx += maxBatchSize) {
			await updateStats.batchTrigger(payloads.slice(idx, idx + maxBatchSize));
			await updateProfile.batchTrigger(payloads.slice(idx, idx + maxBatchSize));
		}
	},
});
