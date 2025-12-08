import { relations, sql } from "drizzle-orm";
import {
	integer,
	sqliteTable,
	text,
	unique,
	type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable(
	"accounts",
	{
		id: integer().primaryKey({ autoIncrement: true }),
		username: text().notNull(),
		nickname: text(),

		lastUpdated: text()
			.$default(() => sql`(CURRENT_DATE)`)
			.$onUpdate(() => sql`(CURRENT_DATE)`),
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
