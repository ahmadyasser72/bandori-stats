import {
	ABBREVIATED_STAT_NAMES,
	STAT_NAMES,
} from "@bandori-stats/bestdori/constants";
import { compareValue, sum } from "@bandori-stats/bestdori/helpers";
import {
	fetchDegrees,
	sortDegrees,
} from "@bandori-stats/bestdori/schema/degree";
import { db, eq } from "@bandori-stats/database";
import { accounts, accountSnapshots } from "@bandori-stats/database/schema";

import { schemaTask, tags } from "@trigger.dev/sdk";
import z from "zod";

import { bestdoriStats } from "./bestdori-stats";
import { updateLeaderboard } from "./update-leaderboard";

export const updateStats = schemaTask({
	id: "update-stats",
	schema: z.strictObject({
		username: z.string().nonempty(),
		date: z.iso.date(),
	}),
	run: async ({ username, date }) => {
		const stats = await bestdoriStats
			.triggerAndWait(
				{ username },
				{ idempotencyKey: `stats_${username}_${date}` },
			)
			.unwrap();
		if (!stats) {
			await tags.add("snapshot_unavailable");
			return;
		}

		const existing = await db.query.accounts.findFirst({
			columns: { id: true },
			where: { username },
			with: {
				snapshots: {
					limit: 1,
					columns: { stats: true },
					where: { snapshotDate: { lte: date } },
					orderBy: { snapshotDate: "desc" },
				},
			},
		});

		if (stats.titles && stats.titles.length > 0) {
			const existingTitles = existing?.snapshots.at(0)?.stats.titles;
			if (!existingTitles || stats.titles.length > existingTitles.length) {
				const allDegrees = await fetchDegrees();
				stats.titles = sortDegrees(stats.titles, allDegrees);
			} else {
				stats.titles = existingTitles;
			}
		}

		let accountId: number | undefined = existing?.id;
		let snapshotId: number | undefined = undefined;

		if (existing && existing.snapshots[0]) {
			const previousStats = existing.snapshots[0].stats;
			const difference = [...STAT_NAMES, "titles" as const].map((name) => ({
				name,
				delta: compareValue(stats[name], previousStats[name]),
			}));

			const deltaTotal = sum(difference.map(({ delta }) => delta));
			if (deltaTotal === 0) {
				await tags.add("diff_none");
				return;
			}

			await tags.add(
				difference
					.filter(({ delta }) => delta > 0)
					.map(
						({ name, delta }) =>
							`diff_${ABBREVIATED_STAT_NAMES[name]}+${delta}`,
					),
			);

			const [newSnapshot] = await db
				.insert(accountSnapshots)
				.values({ accountId: existing.id, stats, snapshotDate: date })
				.onConflictDoUpdate({
					target: [accountSnapshots.accountId, accountSnapshots.snapshotDate],
					set: { stats },
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
				.values({ accountId, stats, snapshotDate: date })
				.returning({ id: accountSnapshots.id });

			snapshotId = newSnapshot!.id;
			await tags.add("snapshot_new");
		}

		if (accountId && snapshotId) {
			await updateLeaderboard.trigger(
				{ date, snapshots: { accountId, stats } },
				{ tags: [`leaderboard_${username}`, `leaderboard_${date}`] },
			);

			await db
				.update(accounts)
				.set({ lastUpdated: date })
				.where(eq(accounts.id, accountId));
		}
	},
});
