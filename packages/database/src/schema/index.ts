import type { Stats } from "@bandori-stats/bestdori/constants";
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
	id: integer().primaryKey({ autoIncrement: true }),
	username: text().unique().notNull(),
	nickname: text(),

	lastUpdated: text()
		.$default(() => sql`(CURRENT_DATE)`)
		.$onUpdate(() => sql`(CURRENT_DATE)`),
});

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
		unique("idx_snapshots_date").on(t.accountId, t.snapshotDate),
		unique("idx_snapshots_stat").on(t.accountId, t.stats),
	],
);
