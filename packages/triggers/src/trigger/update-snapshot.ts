import { AbortTaskRunError, schemaTask, tags } from "@trigger.dev/sdk";
import { sum } from "es-toolkit";
import z from "zod";

import { STAT_NAMES, type Stats } from "@bandori-stats/bestdori/constants";
import {
	abbreviateStatName,
	compareValue,
} from "@bandori-stats/bestdori/helpers";
import {
	fetchDegrees,
	sortDegrees,
} from "@bandori-stats/bestdori/schema/degree";
import { PlayerProfile } from "@bandori-stats/bestdori/schema/player/profile";
import { PlayerStats } from "@bandori-stats/bestdori/schema/player/stats";
import { db, eq } from "@bandori-stats/database";
import {
	PLAYER_STATS_SORTED_SET_PREFIX,
	PLAYER_TITLES_SET,
	redis,
} from "@bandori-stats/database/redis";
import { accounts, accountSnapshots } from "@bandori-stats/database/schema";
import { bestdori } from "~/bestdori";

const fetchStats = async (username: string) => {
	const data = await bestdori({
		path: "api/user/sync",
		schema: PlayerStats,
		query: { username },
	});

	const { uid, stats } = data.accounts
		.filter(({ server }) => server === 1)
		.map((stats) => ({
			uid: stats.uid?.toString() ?? null,
			stats: {
				highScoreRating: stats.hsr ?? null,
				bandRating: stats.dtr ?? null,
				allPerfectCount: stats.allPerfectCount ?? null,
				fullComboCount: stats.fullComboCount ?? null,
				clearCount: stats.clearCount ?? null,
				rank: stats.rank ?? null,
				titles: stats.titles ?? null,
			},
		}))
		.at(0) ?? { uid: null, stats: null };

	return { uid, stats };
};

const fetchProfile = async (username: string) => {
	const { posterCard } = await bestdori({
		path: "api/user",
		schema: PlayerProfile,
		query: { username },
	});

	return { card: posterCard };
};

export const updateSnapshot = schemaTask({
	id: "update-snapshot",
	schema: z.strictObject({
		username: z.string().nonempty(),
		date: z.iso.date(),
	}),
	run: async ({ username, date }) => {
		await Promise.all([
			(async () => {
				const account = await fetchStats(username);

				if (!account.stats) {
					await tags.add("stats_unavailable");
					await db()
						.update(accounts)
						.set({ lastUpdated: date, disabledAt: date })
						.where(eq(accounts.username, username));
					return;
				}

				const existing = await db().query.accounts.findFirst({
					columns: { id: true, uid: true },
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

				const { uid, stats } = account;
				if (stats.titles && stats.titles.length > 0) {
					const existingTitles = existing?.snapshots.at(0)?.stats.titles;
					if (!existingTitles || stats.titles.length > existingTitles.length) {
						const allDegrees = await fetchDegrees(false);
						stats.titles = sortDegrees(stats.titles, allDegrees);
					} else {
						stats.titles = existingTitles;
					}
				}

				let accountId: number | undefined = existing?.id;
				let snapshotId: number | undefined = undefined;

				const previousStats = existing?.snapshots[0]?.stats;
				if (previousStats) {
					for (const name of STAT_NAMES) {
						const current = stats[name];
						const previous = previousStats[name];
						if (previous && (!current || current < previous)) {
							stats[name] = previous;
						}
					}

					const difference = Object.fromEntries(
						[...STAT_NAMES, "titles" as const].map(
							(name): [typeof name, number] => [
								name,
								compareValue(stats[name], previousStats[name]),
							],
						),
					);

					const deltaTotal = sum(Object.values(difference));
					if (deltaTotal === 0) return;

					await tags.add(
						Object.entries(difference)
							.filter(([, delta]) => delta > 0)
							.map(
								([name, delta]) => `diff_${abbreviateStatName(name)}+${delta}`,
							),
					);

					const [newSnapshot] = await db()
						.insert(accountSnapshots)
						.values({ accountId: existing.id, stats, snapshotDate: date })
						.onConflictDoUpdate({
							target: [
								accountSnapshots.accountId,
								accountSnapshots.snapshotDate,
							],
							set: { stats },
						})
						.returning({ id: accountSnapshots.id });

					snapshotId = newSnapshot?.id;
					await tags.add("stats_update");
				} else {
					const [newAccount] = await db()
						.insert(accounts)
						.values({ username })
						.onConflictDoNothing()
						.returning({ id: accounts.id });
					accountId = newAccount ? newAccount.id : existing!.id;

					const [newSnapshot] = await db()
						.insert(accountSnapshots)
						.values({ accountId, stats, snapshotDate: date })
						.returning({ id: accountSnapshots.id });

					snapshotId = newSnapshot!.id;
					await tags.add("stats_new");
				}

				if (accountId && snapshotId) {
					await db()
						.update(accounts)
						.set({ lastUpdated: date, uid: existing?.uid ?? uid })
						.where(eq(accounts.id, accountId));

					await updateRedis(accountId, stats);
				}
			})(),

			(async () => {
				const { card } = await fetchProfile(username);

				const existing = await db().query.accounts.findFirst({
					columns: { id: true, profileArt: true },
					where: { username },
				});
				if (!existing) {
					throw new AbortTaskRunError(
						`Account with username @${username} doesn't exists`,
					);
				}

				if (
					existing.profileArt?.id !== card?.id ||
					existing.profileArt?.trained !== card?.trainedArt
				) {
					await db()
						.update(accounts)
						.set({
							lastUpdated: date,
							profileArt: card
								? { id: card.id, trained: card.trainedArt }
								: null,
						})
						.where(eq(accounts.id, existing.id));
				}
			})(),
		]);
	},
});

const updateRedis = async (accountId: number, stats: Stats) => {
	const pipe = redis().pipeline();

	for (const stat of STAT_NAMES) {
		const score = stats[stat];
		if (score === null) continue;

		pipe.zadd(
			`${PLAYER_STATS_SORTED_SET_PREFIX}:${stat}`,
			{ gt: true, ch: true },
			{ member: accountId, score },
		);
	}

	const titles = stats.titles ?? [];
	if (titles.length > 0)
		pipe.sadd(PLAYER_TITLES_SET, titles[0], ...titles.slice(1));

	await pipe.exec().catch((error) => {
		if (error instanceof Error && error.message.includes("empty")) return;
		throw error;
	});
};
