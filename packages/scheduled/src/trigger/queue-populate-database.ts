import { db } from "@bandori-stats/database";
import { schedules } from "@trigger.dev/sdk/v3";
import dayjs from "dayjs";
import { shuffle } from "fast-shuffle";

import { getLeaderboard, LEADERBOARD_TYPES } from "./get-leaderboard";
import { populateDatabase } from "./populate-database";

export const queuePopulateDatabase = schedules.task({
	id: "queue-populate-database",
	cron: "0 0 * * *",
	run: async (payload) => {
		const existingUsernames = await db.query.accounts
			.findMany({ columns: { username: true } })
			.then((rows) => rows.map(({ username }) => username));

		const leaderboardUsernames = (
			await getLeaderboard.batchTriggerAndWait(
				shuffle(
					Array.from({ length: 4 }).flatMap((_, page) =>
						LEADERBOARD_TYPES.map((type) => ({
							payload: { type, limit: 20, offset: page * 20 },
							options: {
								delay: dayjs()
									.add(Math.random() * 240, "seconds")
									.toDate(),
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

		const date = payload.timestamp.toISOString().slice(0, 10);
		const usernameChunks = shuffle([
			...new Set([...leaderboardUsernames, ...existingUsernames]),
		]).reduce(
			(chunks, next, idx) => {
				chunks[idx % chunks.length]!.push(next);
				return chunks;
			},
			Array.from({ length: 24 }, (): string[] => []),
		);

		populateDatabase.batchTrigger(
			usernameChunks.map((usernames, idx) => ({
				payload: { usernames, date },
				options: {
					delay: dayjs().add(idx, "hours").toDate(),
					tags: `populate-database/${date}/${idx}`,
					idempotencyKey: `populate-database:${date}:${idx}`,
					idempotencyKeyTTL: "1d",
				},
			})),
		);
	},
});
