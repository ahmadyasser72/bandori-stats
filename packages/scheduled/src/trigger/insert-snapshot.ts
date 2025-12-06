import { db, eq } from "@bandori-stats/database";
import {
	ABBREVIATED_STAT_COLUMNS,
	SELECT_STAT_COLUMNS,
} from "@bandori-stats/database/constants";
import { accounts, accountSnapshots } from "@bandori-stats/database/schema";
import { schemaTask, tags } from "@trigger.dev/sdk";
import z from "zod";

import { calculateStatDiff } from "~/utilities";
import { getStats } from "./get-stats";
import { updateLeaderboard } from "./update-leaderboard";

export const insertSnapshot = schemaTask({
	id: "insert-snapshot",
	schema: z.strictObject({
		username: z.string().nonempty(),
		date: z.iso.date(),
	}),
	run: async ({ username, date }) => {
		const stats = await getStats.triggerAndWait({ username }).unwrap();

		if (!stats) {
			await tags.add("snapshot_unavailable");
			return;
		}

		const existing = await db.query.accounts.findFirst({
			columns: { id: true, latestSnapshotId: true },
			where: (t, { eq }) => eq(t.username, username),
			with: { latestSnapshot: { columns: SELECT_STAT_COLUMNS } },
		});

		let accountId: number | undefined = existing?.id;
		let snapshotId: number | undefined = undefined;

		if (existing && existing.latestSnapshot) {
			const diff = calculateStatDiff(existing.latestSnapshot, stats);

			if (diff.delta > 0) {
				const diffTags = Object.entries(diff.details)
					.filter(([, delta]) => delta > 0)
					.map(
						([column, delta]) =>
							`diff_${ABBREVIATED_STAT_COLUMNS[column]}+${delta}`,
					);
				await tags.add(diffTags);

				const [newSnapshot] = await db
					.insert(accountSnapshots)
					.values({ accountId: existing.id, ...stats, snapshotDate: date })
					.onConflictDoUpdate({
						target: [accountSnapshots.accountId, accountSnapshots.snapshotDate],
						set: stats,
					})
					.returning({ id: accountSnapshots.id });

				snapshotId = newSnapshot?.id;
				await tags.add("snapshot_update");
			}
		} else {
			const [newAccount] = await db
				.insert(accounts)
				.values({ server: stats.server, username })
				.onConflictDoNothing()
				.returning({ id: accounts.id });
			accountId = newAccount ? newAccount.id : existing!.id;

			const [newSnapshot] = await db
				.insert(accountSnapshots)
				.values({
					accountId: accountId,
					...stats,
					snapshotDate: date,
				})
				.returning({ id: accountSnapshots.id });
			snapshotId = newSnapshot!.id;

			await tags.add("snapshot_new");
		}

		if (accountId && snapshotId) {
			await db
				.update(accounts)
				.set({ latestSnapshotId: snapshotId })
				.where(eq(accounts.id, accountId));

			await updateLeaderboard.trigger({
				date,
				snapshots: { accountId, ...stats },
			});
		}
	},
});
