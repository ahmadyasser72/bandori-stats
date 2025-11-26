import { db, eq } from "@bandori-stats/database";
import { accounts, accountSnapshots } from "@bandori-stats/database/schema";
import { logger, schemaTask } from "@trigger.dev/sdk";
import z from "zod";

import { getStats } from "./get-stats";
import { SELECT_STAT_COLUMNS } from "./shared";

export const insertSnapshot = schemaTask({
	id: "insert-snapshot",
	schema: z.strictObject({
		username: z.string().nonempty(),
		date: z.iso.date(),
	}),
	run: async ({ username, date }) => {
		const stats = await getStats
			.triggerAndWait(
				{ username },
				{
					tags: `stats/${username}`,
					idempotencyKey: `stats-${username}`,
					idempotencyKeyTTL: "1d",
				},
			)
			.unwrap();

		if (!stats) {
			logger.log("stats unavailable", { username });
			return;
		}

		const existing = await db.query.accounts.findFirst({
			columns: { id: true },
			where: (t, { eq }) => eq(t.username, username),
			with: { latestSnapshot: { columns: SELECT_STAT_COLUMNS } },
		});

		const updateLatestSnapshotId = (accountId: number, snapshotId: number) =>
			db
				.update(accounts)
				.set({ latestSnapshotId: snapshotId })
				.where(eq(accounts.id, accountId));

		if (existing && existing.latestSnapshot) {
			if (
				Object.entries(existing.latestSnapshot).every(
					([key, stat]) =>
						stats[key as keyof typeof existing.latestSnapshot] === stat,
				)
			) {
				logger.log("skipped as nothing has changed", { username, stats, date });
				return;
			}

			const [newSnapshot] = await db
				.insert(accountSnapshots)
				.values({
					accountId: existing.id,
					...existing.latestSnapshot,
					...stats,
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

		const [newSnapshot] = await db
			.insert(accountSnapshots)
			.values({
				accountId: accountId,
				snapshotDate: date,
				...stats,
			})
			.returning({ id: accountSnapshots.id });

		await updateLatestSnapshotId(accountId, newSnapshot!.id);
		return { snapshotId: newSnapshot!.id };
	},
});
