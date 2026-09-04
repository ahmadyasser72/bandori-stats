import { sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";
import { omit } from "es-toolkit";
import type z from "zod";

import type { Stats } from "@bandori-stats/bestdori/constants";
import type {
	GameEventInfo,
	GameEventType,
} from "@bandori-stats/bestdori/schema/misc";
import type {
	PlayerAvatar,
	PlayerBand,
	PlayerBandMemberStateless,
	TrackerKind,
} from "./tracker";

export const accounts = sqliteTable(
	"accounts",
	{
		id: integer().primaryKey({ autoIncrement: true }),
		username: text().unique().notNull(),
		nickname: text(),
		uid: text(),
		profileArt: text({ mode: "json" }).$type<PlayerAvatar>(),

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
		index("idx_snapshots_account_id").on(t.accountId, t.id),
		unique("idx_snapshots_account_date").on(t.accountId, t.snapshotDate),
		unique("idx_snapshots_account_stat").on(t.accountId, t.stats),
	],
);

export type Account = typeof accounts.$inferSelect;
export type Snapshot = typeof accountSnapshots.$inferSelect;

export const { gbpEvents, gbpMonthlyRankings } = (() => {
	const shared = {
		id: integer().primaryKey({ autoIncrement: false }),
		name: text().notNull().unique(),
		assetBundleName: text().notNull(),
		bgmAssetBundleName: text().notNull(),
		bgmFileName: text().notNull(),
		startAt: integer({ mode: "timestamp_ms" }).notNull(),
		endAt: integer({ mode: "timestamp_ms" }).notNull(),
	};

	return {
		gbpEvents: sqliteTable("gbp_events", {
			...shared,
			bannerAssetBundleName: text().notNull(),
			type: text().notNull().$type<z.infer<typeof GameEventType>>(),
			metadata: text({ mode: "json" })
				.notNull()
				.$type<z.infer<typeof GameEventInfo>>(),
		}),
		gbpMonthlyRankings: sqliteTable("gbp_monthly_rankings", shared),
	};
})();

export const gbpEventMusics = sqliteTable(
	"gbp_event_musics",
	{
		eventId: integer().notNull(),
		id: integer().notNull(),
		title: text().notNull(),
		band: text({ mode: "json" }).notNull().$type<{
			id: number;
			name: string;
			type: "normal" | "irregular";
		}>(),
		bgmId: text().notNull(),
		bgmFile: text().notNull(),
		jacketImage: text().notNull(),
	},
	(t) => [primaryKey({ columns: [t.eventId, t.id] })],
);

export const { trackerSnapshots, trackerCutoffs } = (() => {
	const shared = {
		id: integer().primaryKey({ autoIncrement: true }),
		trackingFor: text().$type<TrackerKind>().notNull(),
		trackingId: integer().notNull(),

		uid: text().notNull(),
		name: text().notNull(),
		rank: integer().notNull(),
		point: integer().notNull(),
		timestamp: integer({ mode: "timestamp_ms" }).notNull(),
	} as const;

	return {
		trackerSnapshots: sqliteTable("tracker_snapshots", shared, (t) => [
			index("idx_tracker_1").on(t.trackingFor, t.trackingId, t.uid, t.id),
			index("idx_tracker_2").on(
				t.trackingFor,
				t.trackingId,
				t.uid,
				t.timestamp,
				t.id,
			),
			index("idx_tracker_3").on(
				t.trackingFor,
				t.trackingId,
				t.uid,
				t.point,
				t.id,
			),
			unique("idx_tracker_data").on(
				t.uid,
				t.trackingFor,
				t.trackingId,
				t.name,
				t.rank,
				t.point,
			),
		]),
		trackerCutoffs: sqliteTable(
			"tracker_cutoffs",
			{
				...omit(shared, ["uid"]),
				avatar: text({ mode: "json" }).$type<PlayerBandMemberStateless>(),
			},
			(t) => [
				unique("idx_cutoff_data").on(
					t.trackingFor,
					t.trackingId,
					t.rank,
					t.point,
				),
			],
		),
	};
})();

export const trackerSnapshotProfiles = sqliteTable(
	"tracker_snapshot_profiles",
	{
		id: integer().primaryKey({ autoIncrement: true }),
		trackingFor: text().$type<TrackerKind>().notNull(),
		trackingId: integer().notNull(),

		uid: text().notNull(),
		name: text().notNull(),
		level: integer().notNull(),
		introduction: text().notNull(),
		avatar: text({ mode: "json" }).$type<PlayerBandMemberStateless>(),
		band: text({ mode: "json" }).notNull().$type<PlayerBand>(),
		titles: text({ mode: "json" }).notNull().$type<number[]>(),
	},
	(t) => [unique("idx_tracker_profile").on(t.trackingFor, t.trackingId, t.uid)],
);

export type GbpEvent = typeof gbpEvents.$inferSelect;
export type GbpEventMusic = typeof gbpEventMusics.$inferSelect;
export type GbpMonthlyRanking = typeof gbpMonthlyRankings.$inferSelect;
export type GbpMetadata =
	| ({ kind: "event"; musics: GbpEventMusic[] } & GbpEvent)
	| ({ kind: "monthly" } & GbpMonthlyRanking);

export type TrackerSnapshot = typeof trackerSnapshots.$inferSelect;
export type TrackerCutoff = typeof trackerCutoffs.$inferSelect;
export type TrackerSnapshotProfile =
	typeof trackerSnapshotProfiles.$inferSelect;
