import { db } from "@bandori-stats/database";
import { schedules, tags } from "@trigger.dev/sdk";
import dayjs from "dayjs";
import { createShuffle } from "fast-shuffle";

import { updateStats } from "./update-stats";

export const scheduleUpdateSnapshots = schedules.task({
	id: "schedule-update-snapshots",
	cron: "5 * * * *", // every hour at 5 minutes
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
				).filter((_, idx) => idx % 24 === now.hour()),
			);

		const untilNextHour = now.endOf("hours").diff(now);
		await updateStats.batchTrigger(
			usernames
				.map(({ username, refetch }) => ({
					payload: { username, date, refetch },
					options: {
						delay: now.add(Math.random() * untilNextHour).toDate(),
						tags: `account_${username}`,
						idempotencyKey: `snapshot_${username}_${date}`,
					},
				}))
				.sort((a, b) => a.options.delay.valueOf() - b.options.delay.valueOf()),
		);

		const hour = now.format("HH");
		const size = usernames.length;
		await tags.add([`chunk_#${hour}`, `chunkSize_${size}`]);
	},
});
