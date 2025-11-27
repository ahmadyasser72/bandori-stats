import { relations, sql } from "drizzle-orm";
import {
	integer,
	real,
	sqliteTable,
	sqliteView,
} from "drizzle-orm/sqlite-core";

import { accountSnapshots } from ".";

const STAT_COLUMNS = [
	"rank",
	"clearCount",
	"fullComboCount",
	"allPerfectCount",
	"highScoreRating",
	"bandRating",
] as const;

const statColumns = <K extends (typeof STAT_COLUMNS)[number]>(column: K) => ({
	...Object.fromEntries([[`n_${column}` as const, integer().notNull()]]),
	...Object.fromEntries([
		[`mean_${column}` as const, real().notNull()],
		[`m2_${column}` as const, real().notNull()],
	]),
});

export const zScore = sqliteTable("z_score", {
	id: integer().notNull().primaryKey(),
	latestSnapshotId: integer()
		.notNull()
		.references(() => accountSnapshots.id, {
			onDelete: "cascade",
		}),

	...statColumns("rank"),
	...statColumns("clearCount"),
	...statColumns("fullComboCount"),
	...statColumns("allPerfectCount"),
	...statColumns("highScoreRating"),
	...statColumns("bandRating"),
});

export const zScoreRelations = relations(zScore, ({ one }) => ({
	latestSnapshot: one(accountSnapshots, {
		fields: [zScore.latestSnapshotId],
		references: [accountSnapshots.id],
	}),
}));

export const zScoreStats = sqliteView("z_score_stats").as((qb) =>
	qb
		.select({
			latestSnapshotId: zScore.latestSnapshotId,
			...Object.fromEntries(
				STAT_COLUMNS.flatMap((column) => [
					[
						`variance_${column}` as const,
						sql`
							CASE
								WHEN ${zScore[`n_${column}`]} > 1
								THEN ${zScore[`m2_${column}`]} / (${zScore[`n_${column}`]} - 1)
								ELSE 0
							END
						`.as(`variance_${column}`),
					],
					[
						`stddev_${column}` as const,
						sql`
							CASE
								WHEN ${zScore[`n_${column}`]} > 1
								THEN sqrt(${zScore[`m2_${column}`]} / (${zScore[`n_${column}`]} - 1))
								ELSE 0
							END
						`.as(`stddev_${column}`),
					],
				]),
			),
		})
		.from(zScore),
);
