import { db } from "@bandori-stats/database";
import { schedules } from "@trigger.dev/sdk";
import dayjs from "dayjs";
import { createShuffle } from "fast-shuffle";

import { updateStats } from "./update-stats";

export const scheduleUpdateSnapshots = schedules.task({
	id: "schedule-update-snapshots",
	cron: "5 * * * *", // every hour at 5 minutes
	run: async () => {
		const now = dayjs();
		const date = now.format("YYYY-MM-DD");

		const shuffle = createShuffle(dayjs(date).unix());
		const usernames = await db.query.accounts
			.findMany({ columns: { username: true, lastUpdated: true } })
			.then((entries) =>
				shuffle(
					entries.map((account, idx) => ({
						username: account.username,
						onlyLeaderboard: (() => {
							if (account.lastUpdated === null) return true;

							const lastUpdated = dayjs(account.lastUpdated);
							const updatedLastMonth = now.diff(lastUpdated, "months") < 1;
							const updatedLastWeek = now.diff(lastUpdated, "weeks") < 1;

							return (
								updatedLastWeek ||
								idx % (updatedLastMonth ? now.day() : now.date()) === 0
							);
						})(),
					})),
				).filter((_, idx) => idx % now.get("hours") === 0),
			);

		const untilNextHour = now.endOf("hours").diff(dayjs());
		await updateStats.batchTrigger(
			usernames
				.map(({ username, onlyLeaderboard }) => ({
					payload: { username, date, onlyLeaderboard },
					options: {
						delay: dayjs()
							.add(Math.random() * untilNextHour)
							.toDate(),
						tags: `snapshot_${username}`,
						idempotencyKey: `snapshot_${username}_${date}`,
					},
				}))
				.sort((a, b) => a.options.delay.valueOf() - b.options.delay.valueOf()),
		);
	},
});
