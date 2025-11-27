import { AbortTaskRunError, logger, schemaTask } from "@trigger.dev/sdk";
import dayjs from "dayjs";
import z from "zod";

import { insertSnapshot } from "./insert-snapshot";
import { setZScore } from "./set-z-score";

export const populateDatabase = schemaTask({
	id: "populate-database",
	schema: z.strictObject({
		usernames: z.array(z.string().nonempty()).nonempty(),
		date: z.iso.date(),
	}),
	run: async ({ usernames, date }) => {
		const minutesLeft = dayjs()
			.endOf("hours")
			.subtract(5, "minute")
			.diff(dayjs(), "minutes", true);

		const results = await insertSnapshot.batchTriggerAndWait(
			usernames.map((username) => ({
				payload: { username, date },
				options: {
					delay: dayjs()
						.add(Math.random() * minutesLeft, "minutes")
						.toDate(),
					tags: `snapshot-${username}/${date}`,
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

		await setZScore.trigger(
			{ latestSnapshotId },
			{ tags: `update-z-score-${date}/${dayjs().get("hours")}` },
		);
	},
});
