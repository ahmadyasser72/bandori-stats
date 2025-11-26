import { db, eq } from "@bandori-stats/database";
import { accounts, accountSnapshots } from "@bandori-stats/database/schema";
import { logger, schemaTask } from "@trigger.dev/sdk";
import z from "zod";

const statValue = z.number().nonnegative().nullable();
export const insertSnapshot = schemaTask({
	id: "insert-snapshot",
	schema: z.strictObject({
		server: z.number().nonnegative(),
		username: z.string().nonempty(),
		date: z.iso.date(),
		stats: z.strictObject({
			highScoreRating: statValue,
			bandRating: statValue,
			allPerfectCount: statValue,
			fullComboCount: statValue,
			clearCount: statValue,
			rank: statValue,
		}),
	}),
	run: async ({ server, username, date, stats }) => {
		const existing = await db.query.accounts.findFirst({
			columns: { id: true },
			where: (t, { eq }) => eq(t.username, username),
			with: {
				latestSnapshot: {
					columns: {
						highScoreRating: true,
						bandRating: true,
						allPerfectCount: true,
						fullComboCount: true,
						clearCount: true,
						rank: true,
					},
				},
			},
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

			if (newSnapshot)
				await updateLatestSnapshotId(existing.id, newSnapshot.id);

			return;
		}

		const [newAccount] = await db
			.insert(accounts)
			.values({ server, username })
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
	},
});
