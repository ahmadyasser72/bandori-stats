import type { Region, Stats } from "@bandori-stats/bestdori/constants";

import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable(
	"accounts",
	{
		id: integer().primaryKey({ autoIncrement: true }),
		username: text().notNull(),
		region: text().$type<Region>().notNull(),
		nickname: text(),
		uid: text(),

		lastUpdated: text().$default(() => sql`(CURRENT_DATE)`),
	},
	(t) => [unique("idx_accounts_region_username").on(t.region, t.username)],
);

export const accountSnapshots = sqliteTable(
	"account_snapshots",
	{
		id: integer().primaryKey({ autoIncrement: true }),

		accountId: integer()
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),

		stats: text({ mode: "json" }).$type<Omit<Stats, "uid">>().notNull(),

		snapshotDate: text()
			.default(sql`(CURRENT_DATE)`)
			.notNull(),
	},
	(t) => [
		unique("idx_snapshots_date").on(t.accountId, t.snapshotDate),
		unique("idx_snapshots_stat").on(t.accountId, t.stats),
	],
);
