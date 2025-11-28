import { db } from "@bandori-stats/database";
import { STAT_COLUMNS } from "@bandori-stats/database/constants";
import { logger, schedules } from "@trigger.dev/sdk/v3";
import dayjs from "dayjs";
import { shuffle } from "fast-shuffle";

import { getLeaderboard } from "./get-leaderboard";
import { populateDatabase } from "./populate-database";

export const enqueuePopulateDatabase = schedules.task({
	id: "enqueue-populate-database",
	cron: "0 0 * * *",
	run: async () => {
		const existingUsernames = await db.query.accounts
			.findMany({ columns: { username: true } })
			.then((rows) => rows.map(({ username }) => username));

		const leaderboardUsernames = (
			await getLeaderboard.batchTriggerAndWait(
				Array.from({ length: 4 }).flatMap((_, page) =>
					STAT_COLUMNS.map((type) => ({
						payload: { type, limit: 20, offset: page * 20 },
						options: {
							delay: dayjs()
								.add(Math.random() * 300, "seconds")
								.toDate(),
						},
					})),
				),
			)
		).runs
			.flatMap((run) => (run.ok ? run.output : null))
			.filter((result) => result !== null);

		const date = dayjs().format("YYYY-MM-DD");
		const usernameChunks = shuffle([
			...new Set([...leaderboardUsernames, ...existingUsernames]),
		]).reduce(
			(chunks, next, idx) => {
				chunks[idx % chunks.length]!.push(next);
				return chunks;
			},
			Array.from({ length: 24 }, (): string[] => []),
		);

		logger.log("enqueue usernames", { chunks: usernameChunks, date });
		await populateDatabase.batchTrigger(
			usernameChunks.map((usernames, idx) => ({
				payload: { usernames, date },
				options: {
					delay: dayjs().add(idx, "hours").startOf("hours").toDate(),
					ttl: dayjs().endOf("days").diff(dayjs(), "seconds"),
					tags: `populate_${date}`,
					idempotencyKey: `populate:${date}:${idx}`,
				},
			})),
		);
	},
});
