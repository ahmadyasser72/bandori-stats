import { desc, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";
import type z from "zod";

import type { Stats } from "@bandori-stats/bestdori/constants";
import type { GameEventType } from "@bandori-stats/bestdori/schema/misc";

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
	(t) => [index("idx_account_last_updated").on(t.lastUpdated)],
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
		index("idx_snapshots_account_id").on(t.accountId, desc(t.id)),
		unique("idx_snapshots_account_date").on(t.accountId, t.snapshotDate),
		unique("idx_snapshots_account_stat").on(t.accountId, t.stats),
	],
);

export type Account = typeof accounts.$inferSelect;
export type Snapshot = typeof accountSnapshots.$inferSelect;

export const gbpEvents = sqliteTable("gbp_events", {
	eventId: integer().primaryKey({ autoIncrement: false }),
	eventType: text().notNull().$type<z.infer<typeof GameEventType>>(),
	eventName: text().notNull().unique(),
	assetBundleName: text().notNull(),
	bgmAssetBundleName: text().notNull(),
	bgmFileName: text().notNull(),

	startAt: integer({ mode: "timestamp_ms" }).notNull(),
	endAt: integer({ mode: "timestamp_ms" }).notNull(),
});

export const gbpMonthlyRankings = sqliteTable("gbp_monthly_rankings", {
	monthlyRankingId: integer().primaryKey({ autoIncrement: false }),
	monthlyRankingName: text().notNull().unique(),
	assetBundleName: text().notNull(),
	bgmAssetBundleName: text().notNull(),
	bgmFileName: text().notNull(),

	startAt: integer({ mode: "timestamp_ms" }).notNull(),
	endAt: integer({ mode: "timestamp_ms" }).notNull(),
});

export const trackerSnapshots = sqliteTable(
	"tracker_snapshots",
	{
		id: integer().primaryKey({ autoIncrement: true }),
		trackingFor: text({ enum: ["event", "monthly"] }).notNull(),
		trackingId: integer().notNull(),

		uid: text().notNull(),
		name: text().notNull(),
		rank: integer().notNull(),
		point: integer().notNull(),

		timestamp: integer({ mode: "timestamp_ms" }).notNull(),
	},
	(t) => [
		index("idx_tracker_reference").on(
			t.trackingFor,
			t.trackingId,
			t.uid,
			desc(t.id),
		),
		unique("idx_tracker_data").on(
			t.uid,
			t.trackingFor,
			t.trackingId,
			t.name,
			t.rank,
			t.point,
		),
	],
);

export type GbpEvent = typeof gbpEvents.$inferSelect;
export type GbpMonthlyRanking = typeof gbpMonthlyRankings.$inferSelect;
export type TrackerSnapshot = typeof trackerSnapshots.$inferSelect;
