import { AbortTaskRunError, logger, schemaTask } from "@trigger.dev/sdk";
import dayjs from "dayjs";
import z from "zod";

import { insertSnapshot } from "./insert-snapshot";
import { updateZScore } from "./update-z-score";

export const populateDatabase = schemaTask({
	id: "populate-database",
	schema: z.strictObject({
		usernames: z.array(z.string().nonempty()).nonempty(),
		date: z.iso.date(),
	}),
	run: async ({ usernames, date }, { ctx }) => {
		const results = await insertSnapshot.batchTriggerAndWait(
			usernames.map((username) => ({
				payload: { username, date },
				options: {
					delay: dayjs(ctx.run.startedAt)
						.add(Math.random() * 55)
						.toDate(),
					tags: `${username}/${date}`,
					idempotencyKey: `insert-${username}:${date}`,
					idempotencyKeyTTL: "1d",
				},
			})),
		);

		let latestSnapshotId = 0;
		for (const run of results.runs) {
			if (!run.ok) {
				logger.error("Batch task run error", { error: run.error });
				throw new AbortTaskRunError(
					"Aborting to update z-score since one of the run fails",
				);
			}

			if (run.output !== undefined)
				latestSnapshotId = Math.max(latestSnapshotId, run.output.snapshotId);
		}

		await updateZScore.trigger({ latestSnapshotId });
	},
});
