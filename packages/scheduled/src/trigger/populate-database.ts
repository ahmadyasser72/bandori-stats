import { schemaTask } from "@trigger.dev/sdk";
import dayjs from "dayjs";
import z from "zod";

import { getStats } from "./get-stats";
import { insertSnapshot } from "./insert-snapshot";

export const populateDatabase = schemaTask({
	id: "populate-database",
	schema: z.strictObject({
		usernames: z.array(z.string().nonempty()).nonempty(),
		date: z.iso.date(),
	}),
	run: async ({ usernames, date }, { ctx }) => {
		const stats = (
			await getStats.batchTriggerAndWait(
				usernames.map((username) => ({
					payload: { username },
					options: {
						delay: dayjs(ctx.run.startedAt)
							.add(Math.random() * 60)
							.toDate(),
						tags: `stats/${username}`,
						idempotencyKey: `stats-${username}`,
						idempotencyKeyTTL: "1d",
					},
				})),
			)
		).runs
			.map((run) => (run.ok ? run.output : null))
			.filter((result) => result !== null);

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
