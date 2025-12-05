import { db } from "@bandori-stats/database";
import { STAT_COLUMNS } from "@bandori-stats/database/constants";
import { zScore } from "@bandori-stats/database/schema";
import { logger, schemaTask } from "@trigger.dev/sdk";
import z from "zod";

import { updateStat, zScoreQueue } from "~/z-score";

const snapshotSchema = z.strictObject(
	Object.fromEntries(
		STAT_COLUMNS.map((column) => [column, z.number().nonnegative().nullable()]),
	),
);

export const updateZScore = schemaTask({
	id: "update-z-score",
	schema: z.strictObject({
		previous: snapshotSchema.nullable(),
		current: snapshotSchema,
		date: z.iso.date(),
	}),
	queue: zScoreQueue,
	run: async (snapshot) => {
		const oldZScore = await db.query.zScore.findFirst({
			columns: {
				id: true,
				...Object.fromEntries(
					STAT_COLUMNS.flatMap((column) => [
						[`n_${column}` as const, true],
						[`mean_${column}` as const, true],
						[`m2_${column}` as const, true],
					]),
				),
			},
			where: (t, { lte }) => lte(t.date, snapshot.date),
			orderBy: (t, { desc }) => desc(t.date),
		});

		const newZScore = {
			...Object.fromEntries(
				STAT_COLUMNS.flatMap((column) => [
					[`n_${column}` as const, oldZScore?.[`n_${column}`] ?? 0],
					[`mean_${column}` as const, oldZScore?.[`mean_${column}`] ?? 0],
					[`m2_${column}` as const, oldZScore?.[`m2_${column}`] ?? 0],
				]),
			),
		};

		for (const column of STAT_COLUMNS) {
			const { n, mean, m2 } = updateStat(column, newZScore, {
				newValue: snapshot.current[column],
				oldValue: snapshot.previous?.[column] ?? null,
			});

			newZScore[`n_${column}`] = n;
			newZScore[`mean_${column}`] = mean;
			newZScore[`m2_${column}`] = m2;
		}

		logger.log("update z-score", { from: oldZScore, to: newZScore });

		const { date } = snapshot;
		await db
			.insert(zScore)
			.values({ ...newZScore, date })
			.onConflictDoUpdate({ target: zScore.date, set: newZScore });
	},
});
