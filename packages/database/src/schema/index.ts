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

import { STAT_COLUMNS } from "../constants";

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
	date: text().notNull().unique(),

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
