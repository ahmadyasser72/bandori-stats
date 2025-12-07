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
			.findMany({ columns: { username: true } })
			.then((entries) =>
				shuffle(entries.map(({ username }) => username)).filter(
					(_, idx) => idx % now.get("hours") === 0,
				),
			);

		const untilNextHour = now.endOf("hours").diff(dayjs());
		await updateStats.batchTrigger(
			usernames
				.map((username) => ({
					payload: { username, date },
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
