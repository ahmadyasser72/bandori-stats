import { REGIONS, type Region } from "@bandori-stats/bestdori/constants";
import { db } from "@bandori-stats/database";

import { schedules } from "@trigger.dev/sdk";
import dayjs from "dayjs";
import { createShuffle } from "fast-shuffle";

import { updateStats } from "./update-stats";

export const scheduleUpdateSnapshots = schedules.task({
	id: "schedule-update-snapshots",
	cron: "5 8 * * *", // every day at 08:05 UTC
	run: async (context) => {
		const now = dayjs(context.timestamp);
		const date = now.format("YYYY-MM-DD");

		// Rotate through regions based on day of year
		const dayOfYear = now.dayOfYear();
		const regionIndex = dayOfYear % REGIONS.length;
		const region = REGIONS[regionIndex]!;

		const shuffle = createShuffle(dayjs(date).unix());
		const accounts = await db.query.accounts
			.findMany({
				columns: { id: true, username: true, region: true, lastUpdated: true },
				where: { region },
			})
			.then((entries) =>
				shuffle(entries)
					.map((account, idx) => ({ ...account, idx }))
					.filter((account) => {
						if (account.lastUpdated === null) return true;

						const lastUpdated = dayjs(account.lastUpdated);
						const isRecentlyUpdated = now.diff(lastUpdated, "weeks") < 2;

						return isRecentlyUpdated || account.id % 7 === now.day();
					}),
			);

		const payloads: Parameters<typeof updateStats.batchTrigger>[0] = accounts
			.map(({ username, idx }) => ({
				payload: { username, region, date },
				options: {
					delay: now
						.set("hours", idx % 24)
						.add(Math.random() * 50, "minutes")
						.toDate(),
					tags: `@_${username}`,
				},
			}))
			.sort((a, b) => a.options.delay.valueOf() - b.options.delay.valueOf());

		const maxBatchSize = 1000;
		for (let idx = 0; idx < payloads.length; idx += maxBatchSize)
			await updateStats.batchTrigger(payloads.slice(idx, idx + maxBatchSize));
	},
});
