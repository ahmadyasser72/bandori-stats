import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";

import type { Stats } from "@bandori-stats/bestdori/constants";

export const accounts = sqliteTable(
	"accounts",
	{
		id: integer().primaryKey({ autoIncrement: true }),
		username: text().unique().notNull(),
		nickname: text(),
		uid: text(),
		profileArt: text({ mode: "json" }).$type<{
			id: number;
			trained: boolean;
		}>(),

		lastUpdated: text().$default(() => sql`(CURRENT_DATE)`),
		disabledAt: text(),
	},
	(t) => [
		index("idx_account_nickname").on(t.nickname),
		index("idx_account_last_updated").on(t.lastUpdated),
	],
);

export const accountSnapshots = sqliteTable(
	"account_snapshots",
	{
		id: integer().primaryKey({ autoIncrement: true }),

		accountId: integer()
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),

		stats: text({ mode: "json" }).$type<Stats>().notNull(),

		snapshotDate: text()
			.default(sql`(CURRENT_DATE)`)
			.notNull(),
	},
	(t) => [
		index("idx_snapshots_date").on(t.snapshotDate),
		unique("idx_snapshots_account_date").on(t.accountId, t.snapshotDate),
		unique("idx_snapshots_account_stat").on(t.accountId, t.stats),
	],
);

export type Account = typeof accounts.$inferSelect;
export type Snapshot = typeof accountSnapshots.$inferSelect;
