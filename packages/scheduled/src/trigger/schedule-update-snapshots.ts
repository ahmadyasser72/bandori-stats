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
		const usernames = await db.query.accounts
			.findMany({ columns: { username: true, lastUpdated: true } })
			.then((entries) =>
				shuffle(
					entries.map((account, idx) => ({
						username: account.username,
						refetch: (() => {
							if (account.lastUpdated === null) return true;

							const lastUpdated = dayjs(account.lastUpdated);
							const updatedLastMonth = now.diff(lastUpdated, "months") < 1;
							const updatedLastWeek = now.diff(lastUpdated, "weeks") < 1;

							return (
								updatedLastWeek ||
								(updatedLastMonth
									? idx % 7 === now.day()
									: idx % now.daysInMonth() === now.date())
							);
						})(),
					})),
				),
			);

		const items: Parameters<typeof updateStats.batchTrigger>[0] = usernames
			.map(({ username, refetch }, idx) => ({
				payload: { username, date, refetch },
				options: {
					delay: now
						.set("hours", idx % 24)
						.add(Math.random() * 50, "minutes")
						.toDate(),
					tags: `account_${username}`,
					idempotencyKey: `snapshot_${username}_${date}`,
				},
			}))
			.sort((a, b) => a.options.delay.valueOf() - b.options.delay.valueOf());

		const maxBatchSize = 500;
		for (let idx = 0; idx < items.length; idx += maxBatchSize)
			await updateStats.batchTrigger(items.slice(idx, idx + maxBatchSize));
	},
});
