import { and, eq, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	sqliteView,
	text,
} from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable(
	"accounts",
	{
		id: integer().primaryKey({ autoIncrement: true }),
		username: text().notNull(),
		server: integer().notNull(),
	},
	(t) => [index("idx_accounts_username").on(t.username)],
);

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
	(t) => [index("idx_snapshots_account_date").on(t.accountId, t.snapshotDate)],
);

export const latestSnapshots = sqliteView("latest_snapshots").as((qb) => {
	// Subquery: latest date per account
	const latestDateSq = qb
		.select({
			accountId: accountSnapshots.accountId,
			latestDate: sql`MAX(${accountSnapshots.snapshotDate})`.as("latestDate"),
		})
		.from(accountSnapshots)
		.groupBy(accountSnapshots.accountId)
		.as("latest");

	return qb
		.select({
			accountId: accounts.id,
			username: accounts.username,
			server: accounts.server,

			snapshotDate: accountSnapshots.snapshotDate,
			rank: accountSnapshots.rank,
			clearCount: accountSnapshots.clearCount,
			fullComboCount: accountSnapshots.fullComboCount,
			allPerfectCount: accountSnapshots.allPerfectCount,
			highScoreRating: accountSnapshots.highScoreRating,
			bandRating: accountSnapshots.bandRating,
		})
		.from(accounts)
		.innerJoin(latestDateSq, eq(accounts.id, latestDateSq.accountId))
		.innerJoin(
			accountSnapshots,
			and(
				eq(accountSnapshots.accountId, latestDateSq.accountId),
				eq(accountSnapshots.snapshotDate, latestDateSq.latestDate),
			),
		);
});
