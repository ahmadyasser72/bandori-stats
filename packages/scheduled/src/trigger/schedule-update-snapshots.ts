import { db } from "@bandori-stats/database";

import { schedules } from "@trigger.dev/sdk";
import dayjs from "dayjs";
import { createShuffle } from "fast-shuffle";

import { updateStats } from "./update-stats";

export const scheduleUpdateSnapshots = schedules.task({
	id: "schedule-update-snapshots",
	cron: "5 0 * * *", // every day at 00:05
	run: async (context) => {
		const now = dayjs(context.timestamp);
		const date = now.format("YYYY-MM-DD");

		const shuffle = createShuffle(dayjs(date).unix());
		const accounts = await db.query.accounts
			.findMany({ columns: { id: true, username: true, lastUpdated: true } })
			.then((entries) =>
				shuffle(entries)
					.map((account, idx) => ({ ...account, idx }))
					.filter((account) => {
						if (account.lastUpdated === null) return true;

						const lastUpdated = dayjs(account.lastUpdated);
						const updatedLastWeek = now.diff(lastUpdated, "weeks") < 1;

						return updatedLastWeek || account.id % 7 === now.day();
					}),
			);

		const payloads: Parameters<typeof updateStats.batchTrigger>[0] = accounts
			.map(({ username, idx }) => ({
				payload: { username, date },
				options: {
					delay: now
						.set("hours", idx % 24)
						.add(Math.random() * 50, "minutes")
						.toDate(),
					tags: `account_${username}`,
				},
			}))
			.sort((a, b) => a.options.delay.valueOf() - b.options.delay.valueOf());

		const maxBatchSize = 1000;
		for (let idx = 0; idx < payloads.length; idx += maxBatchSize)
			await updateStats.batchTrigger(payloads.slice(idx, idx + maxBatchSize));
	},
});
