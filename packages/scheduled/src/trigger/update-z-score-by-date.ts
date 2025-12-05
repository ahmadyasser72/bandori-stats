import { db } from "@bandori-stats/database";
import {
	SELECT_STAT_COLUMNS,
	STAT_COLUMNS,
} from "@bandori-stats/database/constants";
import { zScore } from "@bandori-stats/database/schema";
import { schemaTask } from "@trigger.dev/sdk";
import z from "zod";

import { updateStat, zScoreQueue } from "~/z-score";

export const updateZScoreByDate = schemaTask({
	id: "update-z-score-by-date",
	schema: z.strictObject({ date: z.iso.date() }),
	queue: zScoreQueue,
	run: async ({ date }) => {
		const snapshots = await db.query.accounts
			.findMany({
				columns: {},
				with: {
					snapshots: {
						limit: 1,
						columns: SELECT_STAT_COLUMNS,
						where: (t, { lte }) => lte(t.snapshotDate, date),
						orderBy: (t, { desc }) => desc(t.snapshotDate),
					},
				},
			})
			.then((accounts) => accounts.flatMap(({ snapshots }) => snapshots));

		const newZScore = Object.fromEntries(
			STAT_COLUMNS.flatMap((column) => [
				[`n_${column}` as const, 0],
				[`mean_${column}` as const, 0],
				[`m2_${column}` as const, 0],
			]),
		);

		for (const snapshot of snapshots) {
			for (const column of STAT_COLUMNS) {
				const { n, mean, m2 } = updateStat(column, newZScore, {
					newValue: snapshot[column],
					oldValue: null,
				});

				newZScore[`n_${column}`] = n;
				newZScore[`mean_${column}`] = mean;
				newZScore[`m2_${column}`] = m2;
			}
		}

		await db
			.insert(zScore)
			.values({ ...newZScore, date })
			.onConflictDoUpdate({ target: zScore.date, set: newZScore });
	},
});
