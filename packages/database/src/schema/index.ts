import { eq, isNotNull, relations, sql } from "drizzle-orm";
import {
	integer,
	real,
	sqliteTable,
	sqliteView,
	text,
	unique,
	type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

import { STAT_COLUMNS, type StatName } from "../constants";

export const accounts = sqliteTable(
	"accounts",
	{
		id: integer().primaryKey({ autoIncrement: true }),
		username: text().notNull(),
		server: integer().notNull(),

		latestSnapshotId: integer().references(
			(): AnySQLiteColumn => accountSnapshots.id,
			{ onDelete: "set null" },
		),
	},
	(t) => [
		unique("idx_accounts_username").on(t.username),
		unique("idx_latest_snapshot").on(t.latestSnapshotId),
	],
);

export const accountsRelations = relations(accounts, ({ one, many }) => ({
	latestSnapshot: one(accountSnapshots, {
		fields: [accounts.latestSnapshotId],
		references: [accountSnapshots.id],
		relationName: "latestSnapshot",
	}),
	snapshots: many(accountSnapshots, { relationName: "snapshotAccount" }),
}));

export const accountSnapshots = sqliteTable(
	"account_snapshots",
	{
		id: integer().primaryKey({ autoIncrement: true }),

		accountId: integer()
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),

		rank: integer(),
		clearCount: integer(),
		fullComboCount: integer(),
		allPerfectCount: integer(),

		highScoreRating: integer(),
		bandRating: integer(),

		snapshotDate: text()
			.default(sql`(CURRENT_DATE)`)
			.notNull(),
	},
	(t) => [
		unique("idx_snapshots_date").on(t.accountId, t.snapshotDate),
		unique("idx_snapshots_stat").on(
			t.accountId,
			t.rank,
			t.clearCount,
			t.fullComboCount,
			t.allPerfectCount,
			t.highScoreRating,
			t.bandRating,
		),
	],
);

export const accountSnapshotsRelations = relations(
	accountSnapshots,
	({ one }) => ({
		account: one(accounts, {
			fields: [accountSnapshots.accountId],
			references: [accounts.id],
			relationName: "snapshotAccount",
		}),
	}),
);

export const zScore = sqliteTable("z_score", {
	id: integer().notNull().primaryKey(),
	latestSnapshotId: integer()
		.notNull()
		.references(() => accountSnapshots.id, {
			onDelete: "cascade",
		}),

	...Object.fromEntries(
		STAT_COLUMNS.map((column) => [`n_${column}` as const, integer().notNull()]),
	),
	...Object.fromEntries(
		STAT_COLUMNS.flatMap((column) => [
			[`mean_${column}` as const, real().notNull()],
			[`m2_${column}` as const, real().notNull()],
		]),
	),
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
			lastUpdated: sql<string>`${accountSnapshots.snapshotDate}`.as(
				"lastUpdated",
			),
			...Object.fromEntries(
				STAT_COLUMNS.map((column) => [
					column,
					sql<number | null>`${accountSnapshots[column]}`.as(column),
				]),
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
