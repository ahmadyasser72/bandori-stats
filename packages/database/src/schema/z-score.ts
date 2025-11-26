import { relations, sql } from "drizzle-orm";
import { integer, real, sqliteTable } from "drizzle-orm/sqlite-core";

import { accountSnapshots } from ".";

const STAT_COLUMNS = Object.fromEntries(
	(
		[
			"rank",
			"clearCount",
			"fullComboCount",
			"allPerfectCount",
			"highScoreRating",
			"bandRating",
		] as const
	).flatMap(
		(column) =>
			[
				[`sum_${column}`, real().notNull()],
				[`sum_${column}2`, real().notNull()],
				[
					`mean_${column}`,
					real()
						.notNull()
						.generatedAlwaysAs(sql.raw(`sum_${column} / rowCount`), {
							mode: "stored",
						}),
				],
			] as const,
	),
);

export const zScore = sqliteTable("z_score", {
	id: integer().notNull().primaryKey(),
	latestSnapshotId: integer()
		.notNull()
		.references(() => accountSnapshots.id, {
			onDelete: "cascade",
		}),

	rowCount: integer().notNull(),
	...STAT_COLUMNS,
});

export const zScoreRelations = relations(zScore, ({ one }) => ({
	latestSnapshot: one(accountSnapshots, {
		fields: [zScore.latestSnapshotId],
		references: [accountSnapshots.id],
	}),
}));
