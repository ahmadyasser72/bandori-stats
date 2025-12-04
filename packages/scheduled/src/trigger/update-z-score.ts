import { db } from "@bandori-stats/database";
import { STAT_COLUMNS } from "@bandori-stats/database/constants";
import { zScore } from "@bandori-stats/database/schema";
import { logger, schemaTask } from "@trigger.dev/sdk";
import z from "zod";

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
	}),
	queue: { name: "z-score-queue", concurrencyLimit: 1 },
	run: async (snapshot) => {
		const zScoreCurrent = await db.query.zScore.findFirst({
			columns: {
				...Object.fromEntries(
					STAT_COLUMNS.flatMap((column) => [
						[`n_${column}` as const, true],
						[`mean_${column}` as const, true],
						[`m2_${column}` as const, true],
					]),
				),
			},
		});

		const zScoreNext = Object.fromEntries(
			STAT_COLUMNS.flatMap((column) => [
				[`n_${column}` as const, zScoreCurrent?.[`n_${column}`] ?? 0],
				[`mean_${column}` as const, zScoreCurrent?.[`mean_${column}`] ?? 0],
				[`m2_${column}` as const, zScoreCurrent?.[`m2_${column}`] ?? 0],
			]),
		);

		for (const column of STAT_COLUMNS) {
			const newValue = snapshot.current[column];
			const oldValue = snapshot.previous?.[column] ?? null;

			let n = zScoreNext[`n_${column}`]!;
			let mean = zScoreNext[`mean_${column}`]!;
			let m2 = zScoreNext[`m2_${column}`]!;

			if (oldValue !== null) {
				if (n > 1) {
					const delta = oldValue - mean;
					mean -= delta / (n - 1);
					m2 -= delta * (oldValue - mean);
				} else {
					mean = 0;
					m2 = 0;
				}

				n -= 1;
			}

			if (newValue !== null) {
				const delta = newValue - mean;
				n += 1;
				mean += delta / n;
				m2 += delta * (newValue - mean);
			}

			zScoreNext[`n_${column}`] = n;
			zScoreNext[`mean_${column}`] = mean;
			zScoreNext[`m2_${column}`] = m2;
		}

		logger.log("update z-score", { from: zScoreCurrent, to: zScoreNext });
		if (zScoreCurrent) await db.update(zScore).set(zScoreNext);
		else await db.insert(zScore).values(zScoreNext);
	},
});
