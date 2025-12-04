import { db, eq } from "@bandori-stats/database";
import {
	ABBREVIATED_STAT_COLUMNS,
	SELECT_STAT_COLUMNS,
	STAT_COLUMNS,
} from "@bandori-stats/database/constants";
import { accounts, accountSnapshots } from "@bandori-stats/database/schema";
import { logger, schemaTask, tags } from "@trigger.dev/sdk";
import z from "zod";

import { getStats } from "./get-stats";

export const insertSnapshot = schemaTask({
	id: "insert-snapshot",
	schema: z.strictObject({
		username: z.string().nonempty(),
		date: z.iso.date(),
	}),
	run: async ({ username, date }) => {
		const stats = await getStats.triggerAndWait({ username }).unwrap();

		if (!stats) {
			logger.log("stats unavailable", { username });
			return;
		}

		const existing = await db.query.accounts.findFirst({
			columns: { id: true, latestSnapshotId: true },
			where: (t, { eq }) => eq(t.username, username),
			with: { latestSnapshot: { columns: SELECT_STAT_COLUMNS } },
		});

		const updateLatestSnapshotId = async (
			accountId: number,
			snapshotId: number,
		) => {
			if (existing)
				logger.log("update latest snapshot id", {
					from: existing.latestSnapshotId,
					to: snapshotId,
				});

			await tags.add([
				!!existing ? "snapshot_update" : "snapshot_new",
				`snapshot_${date}`,
			]);
			await db
				.update(accounts)
				.set({ latestSnapshotId: snapshotId })
				.where(eq(accounts.id, accountId));
		};

		if (existing && existing.latestSnapshot) {
			const difference = STAT_COLUMNS.reduce(
				(acc, column) => {
					const oldValue = existing.latestSnapshot![column];
					const newValue = stats[column];

					acc.detailed[column] =
						oldValue === null && newValue === null
							? 0
							: oldValue === null || newValue === null
								? 1
								: Math.abs(oldValue - newValue);

					acc.delta += acc.detailed[column];
					return acc;
				},
				{
					delta: 0,
					detailed: Object.fromEntries(
						STAT_COLUMNS.map((column) => [column, 0]),
					),
				},
			);

			if (difference.delta === 0) {
				logger.log("skipped", { username, stats, date });
				return;
			} else {
				const differenceTags = Object.entries(difference.detailed)
					.filter(([, delta]) => delta > 0)
					.map(
						([column, delta]) =>
							`diff_${ABBREVIATED_STAT_COLUMNS[column]}+${delta}`,
					);

				await tags.add(differenceTags);
				logger.info("snapshot diff", { difference });
			}

			const snapshot = { ...existing.latestSnapshot, ...stats };
			logger.log("inserting snapshot", { username, snapshot, date });
			const [newSnapshot] = await db
				.insert(accountSnapshots)
				.values({
					accountId: existing.id,
					...snapshot,
					snapshotDate: date,
				})
				.onConflictDoUpdate({
					target: [accountSnapshots.accountId, accountSnapshots.snapshotDate],
					set: stats,
				})
				.returning({ id: accountSnapshots.id });

			if (newSnapshot) {
				await updateLatestSnapshotId(existing.id, newSnapshot.id);
				return { snapshotId: newSnapshot.id };
			}

			return;
		}

		logger.log("inserting new account", { username });
		const [newAccount] = await db
			.insert(accounts)
			.values({ server: stats.server, username })
			.onConflictDoNothing()
			.returning({ id: accounts.id });

		const accountId = newAccount ? newAccount.id : existing!.id;

		logger.log("inserting snapshot", { username, snapshot: stats, date });
		const [newSnapshot] = await db
			.insert(accountSnapshots)
			.values({
				accountId: accountId,
				...stats,
				snapshotDate: date,
			})
			.returning({ id: accountSnapshots.id });

		await updateLatestSnapshotId(accountId, newSnapshot!.id);
		return { snapshotId: newSnapshot!.id };
	},
});
