import { eq, isNotNull, relations, sql } from "drizzle-orm";
import {
	integer,
	real,
	sqliteTable,
	sqliteView,
} from "drizzle-orm/sqlite-core";

import { accounts, accountSnapshots } from ".";
import { STAT_COLUMNS, type StatName } from "../constants";

const statColumns = <K extends StatName>(column: K) => ({
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
						`mean_${column}` as const,
						sql<number>`${zScore[`mean_${column}`]}`.as(`mean_${column}`),
					],
					[
						`variance_${column}` as const,
						sql<number>`
							CASE
								WHEN ${zScore[`n_${column}`]} > 1
								THEN ${zScore[`m2_${column}`]} / (${zScore[`n_${column}`]} - 1)
								ELSE 0
							END
						`.as(`variance_${column}`),
					],
					[
						`stddev_${column}` as const,
						sql<number>`
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

export const accountLeaderboard = sqliteView("account_leaderboard").as((qb) =>
	qb
		.select({
			acccountId: accounts.id,
			username: accounts.username,
			...Object.fromEntries(
				STAT_COLUMNS.map((column) => [column, accountSnapshots[column]]),
			),
			...Object.fromEntries(
				STAT_COLUMNS.map((column) => [
					`score_${column}` as const,
					sql<number>`
						(COALESCE(${accountSnapshots[column]}, 0) - ${zScoreStats[`mean_${column}`]})
						/ ${zScoreStats[`stddev_${column}`]}
					`.as(`score_${column}`),
				]),
			),
		})
		.from(accounts)
		.where(isNotNull(accounts.latestSnapshotId))
		.leftJoin(
			accountSnapshots,
			eq(accounts.latestSnapshotId, accountSnapshots.id),
		)
		.crossJoin(zScoreStats),
);
