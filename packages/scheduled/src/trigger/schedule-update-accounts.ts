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

		const usernameNickname = new Map<string, string | null>();
		for (const run of runs) {
			if (!run.ok) throw new AbortTaskRunError(`Run #${run.id} failed`);
			for (const { username, nickname } of run.output)
				usernameNickname.set(username, nickname);
		}

		const data = [...usernameNickname.entries()].map(
			([username, nickname]) => ({ username, nickname }),
		);
		logger.log("inserting accounts", { size: data.length, data });

		const rowsAffected = await Promise.all(
			data.map((account) =>
				db
					.insert(accounts)
					.values(account)
					.onConflictDoUpdate({
						target: accounts.username,
						set: { nickname: account.nickname },
					}),
			),
		).then((results) =>
			results.reduce((acc, { rowsAffected }) => acc + rowsAffected, 0),
		);

		await tags.add([`accounts_${data.length}`, `accounts_+${rowsAffected}`]);
	},
});
