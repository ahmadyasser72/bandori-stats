import { db } from "@bandori-stats/database";
import {
	ABBREVIATED_STAT_COLUMNS,
	SELECT_STAT_COLUMNS,
} from "@bandori-stats/database/constants";
import { accounts, accountSnapshots } from "@bandori-stats/database/schema";
import { schemaTask, tags } from "@trigger.dev/sdk";
import z from "zod";

import { compareStats } from "~/utilities";
import { bestdoriStats } from "./bestdori-stats";
import { updateLeaderboard } from "./update-leaderboard";

export const updateStats = schemaTask({
	id: "update-stats",
	schema: z.strictObject({
		username: z.string().nonempty(),
		date: z.iso.date(),
		refetch: z.boolean(),
	}),
	run: async ({ username, date, refetch }) => {
		if (!refetch) await tags.add("snapshot_nofetch");

		const snapshot = await (async () => {
			const existing = await db.query.accounts.findFirst({
				columns: { id: true },
				where: (t, { eq }) => eq(t.username, username),
				with: {
					snapshots: {
						limit: 1,
						columns: SELECT_STAT_COLUMNS,
						orderBy: (t, { desc }) => desc(t.snapshotDate),
						where: (t, { lte }) => lte(t.snapshotDate, date),
					},
				},
			});

			const stats = refetch
				? await bestdoriStats.triggerAndWait({ username }).unwrap()
				: (existing?.snapshots.pop() ?? null);

			return { stats, existing };
		})();

		const { existing, stats } = snapshot;

		if (!stats) {
			await tags.add("snapshot_unavailable");
			return;
		}

		let accountId: number | undefined = existing?.id;
		let snapshotId: number | undefined = undefined;

		if (existing && existing.snapshots[0]) {
			const [from, to] = [existing.snapshots[0], stats];
			const { delta, difference } = compareStats(from, to);
			if (delta === 0) {
				await tags.add("diff_none");
				return;
			}

			await tags.add(
				Object.entries(difference)
					.filter(([, delta]) => delta > 0)
					.map(
						([column, delta]) =>
							`diff_${ABBREVIATED_STAT_COLUMNS[column]}+${delta}`,
					),
			);

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
		} else {
			const [newAccount] = await db
				.insert(accounts)
				.values({ username })
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
			await updateLeaderboard.trigger({
				date,
				snapshots: { accountId, ...stats },
			});
		}
	},
});
