import { db } from "@bandori-stats/database";
import { logger, schedules } from "@trigger.dev/sdk/v3";
import { shuffle } from "fast-shuffle";

import { getLeaderboard, LEADERBOARD_TYPES } from "./get-leaderboard";
import { getStats } from "./get-stats";
import { insertSnapshot } from "./insert-snapshot";

export const populateDatabase = schedules.task({
	id: "populate-database",
	cron: "0 0 * * *",
	run: async (payload) => {
		logger.log("querying latest snapshots");
		const existingUsernames = await db.query.accounts
			.findMany({ columns: { username: true } })
			.then((rows) => rows.map(({ username }) => username));

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
			...new Set([...leaderboardUsernames, ...existingUsernames]),
		]);

		logger.log("fetching all stats", { usernames });
		const stats = (
			await getStats.batchTriggerAndWait(
				usernames.map((username) => ({
					payload: { username },
					options: {
						tags: `stats/${username}`,
						idempotencyKey: `stats-${username}`,
						idempotencyKeyTTL: "1d",
					},
				})),
			)
		).runs
			.map((run) => (run.ok ? run.output : null))
			.filter((result) => result !== null);

		const date = payload.timestamp.toISOString().slice(0, 10);
		await insertSnapshot.batchTrigger(
			stats.map(({ server, username, ...stats }) => ({
				payload: { server, username, date, stats },
				options: {
					tags: `${username}/${date}`,
					idempotencyKey: `insert-${username}:${date}`,
					idempotencyKeyTTL: "1d",
				},
			})),
		);
	},
});
