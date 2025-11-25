import { db, eq, sql } from "@bandori-stats/database";
import {
	accounts,
	accountSnapshots,
	latestSnapshots,
} from "@bandori-stats/database/schema";
import { logger, schedules } from "@trigger.dev/sdk/v3";
import { shuffle } from "fast-shuffle";

import { getLeaderboard, LEADERBOARD_TYPES } from "./get-leaderboard";
import { getStats } from "./get-stats";

export const populateDatabase = schedules.task({
	id: "populate-database",
	cron: "0 0 * * *",
	run: async (payload) => {
		logger.log("querying latest snapshots");
		const latestSnapshotsByUsername = await db
			.select()
			.from(latestSnapshots)
			.then((rows) =>
				rows.map(({ username, ...rest }) => [username, rest] as const),
			)
			.then((entries) => Object.fromEntries(entries));

		logger.log("fetching leaderboard usernames");
		const leaderboardUsernames = (
			await getLeaderboard.batchTriggerAndWait(
				shuffle(
					Array.from({ length: 4 }).flatMap((_, page) =>
						LEADERBOARD_TYPES.map((type) => ({
							payload: { type, limit: 20, offset: page * 20 },
							options: {
								tags: `leaderboard/${type}/${page}`,
								idempotencyKey: `leaderboard-${type}-${page}`,
								idempotencyKeyTTL: "1d",
							},
						})),
					),
				),
			)
		).runs
			.flatMap((run) => (run.ok ? run.output : null))
			.filter((result) => result !== null);

		const usernames = shuffle([
			...new Set([
				...leaderboardUsernames,
				...Object.keys(latestSnapshotsByUsername),
			]),
		]);

		logger.log("fetching all stats", { usernames });
		const stats = (
			await getStats.batchTriggerAndWait(
				usernames.map((username) => ({
					payload: { username },
					options: {
						tags: `user/${username}`,
						idempotencyKey: `stats-${username}`,
						idempotencyKeyTTL: "1d",
					},
				})),
			)
		).runs
			.map((run) => (run.ok ? run.output : null))
			.filter((result) => result !== null);

		const snapshotDate = payload.timestamp.toISOString().slice(0, 10);
		logger.info("using snapshotDate", { snapshotDate });

		logger.log("creating queries", { stats });
		const queries = stats.flatMap(({ username, ...stat }) => {
			const snapshot = latestSnapshotsByUsername[username];
			if (snapshot) {
				const { server, ...newStat } = stat;
				const { accountId, ...previousStat } = snapshot;

				const nothingHasChanged = Object.entries(newStat).every(
					([key, value]) => previousStat[key as keyof typeof newStat] === value,
				);
				if (nothingHasChanged) {
					logger.debug("nothing has changed", { accountId, username });
					return [];
				}

				return db
					.insert(accountSnapshots)
					.values({ accountId, ...previousStat, ...newStat, snapshotDate })
					.onConflictDoUpdate({
						target: [accountSnapshots.accountId, accountSnapshots.snapshotDate],
						set: stat,
					});
			}

			logger.debug("creating new account", { username });
			const insertNewAccount = db
				.insert(accounts)
				.values({ server: stat.server, username });

			const newAccount = db
				.$with("new_account")
				.as(
					db
						.select({ accountId: accounts.id })
						.from(accounts)
						.where(eq(accounts.username, username))
						.limit(1),
				);
			const insertSnapshot = db
				.with(newAccount)
				.insert(accountSnapshots)
				.values({
					accountId: sql`(select ${newAccount.accountId} from ${newAccount})`,
					snapshotDate,
					...stat,
				});

			return [insertNewAccount, insertSnapshot];
		});

		logger.log("sending queries", { length: queries.length });
		await db.batch(queries as never);
	},
});
