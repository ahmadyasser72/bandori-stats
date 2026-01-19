import { STAT_NAMES } from "@bandori-stats/bestdori/constants";
import { db, eq } from "@bandori-stats/database";
import { accounts } from "@bandori-stats/database/schema";

import { AbortTaskRunError, schedules, tags } from "@trigger.dev/sdk";
import dayjs from "dayjs";

import { bestdoriLeaderboard } from "./bestdori-leaderboard";

export const scheduleUpdateAccounts = schedules.task({
	id: "schedule-update-accounts",
	cron: "0 0 1 * *", // every 1st day of month
	run: async (context) => {
		const now = dayjs(context.timestamp);
		const untilNextSnapshotUpdate = now.add(4.5, "minutes").diff(now);
		const { runs } = await bestdoriLeaderboard.batchTriggerAndWait(
			Array.from({ length: 4 }).flatMap((_, page) =>
				STAT_NAMES.map((type) => ({
					payload: { type, limit: 50, offset: page * 50 },
					options: {
						delay: now.add(Math.random() * untilNextSnapshotUpdate).toDate(),
					},
				})),
			),
		);

		const usernameToNickname = new Map<string, string | null>();
		for (const run of runs) {
			if (!run.ok) throw new AbortTaskRunError(`Run #${run.id} failed`);
			for (const { username, nickname } of run.output)
				usernameToNickname.set(username, nickname);
		}

		const existingAccounts = await db.query.accounts.findMany();
		const rowsAffected = await Promise.all(
			[...usernameToNickname.entries()].map(([username, nickname]) => {
				const existing = existingAccounts.find(
					(it) => it.username === username,
				);

				return existing !== undefined
					? db
							.update(accounts)
							.set({ nickname: nickname })
							.where(eq(accounts.id, existing.id))
					: db.insert(accounts).values({ username, nickname });
			}),
		).then((results) =>
			results.reduce((acc, { rowsAffected }) => acc + rowsAffected, 0),
		);

		await tags.add([
			`accounts_${now.format("MMM")}`,
			`accounts_~${rowsAffected}`,
		]);
	},
});
