import { db } from "@bandori-stats/database";
import { STAT_COLUMNS } from "@bandori-stats/database/constants";
import { accounts } from "@bandori-stats/database/schema";
import { AbortTaskRunError, logger, schedules, tags } from "@trigger.dev/sdk";
import dayjs from "dayjs";

import { bestdoriLeaderboard } from "./bestdori-leaderboard";

export const scheduleUpdateAccounts = schedules.task({
	id: "schedule-update-accounts",
	cron: "0 0 1 * *", // every 1st day of month
	run: async (context) => {
		const timestamp = dayjs(context.timestamp);
		const untilNextSnapshotUpdate = timestamp.add(4.5, "minutes").diff(dayjs());
		const { runs } = await bestdoriLeaderboard.batchTriggerAndWait(
			Array.from({ length: 4 }).flatMap((_, page) =>
				STAT_COLUMNS.map((type) => ({
					payload: { type, limit: 50, offset: page * 50 },
					options: {
						delay: dayjs()
							.add(Math.random() * untilNextSnapshotUpdate)
							.toDate(),
					},
				})),
			),
		);

		const usernameSet = new Set<string>();
		for (const run of runs) {
			if (!run.ok) throw new AbortTaskRunError(`Run #${run.id} failed`);
			for (const username of run.output) usernameSet.add(username);
		}

		const usernames = [...usernameSet];
		logger.log("inserting accounts", { length: usernames.length, usernames });
		const result = await db
			.insert(accounts)
			.values(usernames.map((username) => ({ username })))
			.onConflictDoNothing({ target: [accounts.username] });

		await tags.add([
			`accounts_${usernames.length}`,
			`accounts_+${result.rowsAffected}`,
		]);
	},
});
