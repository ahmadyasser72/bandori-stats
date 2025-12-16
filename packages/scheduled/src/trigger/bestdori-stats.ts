import {
	ABBREVIATED_STAT_COLUMNS,
	STAT_COLUMNS,
	type Stat,
} from "@bandori-stats/database/constants";
import { AbortTaskRunError, schemaTask, tags } from "@trigger.dev/sdk/v3";
import z from "zod";

import { bestdori, bestdoriQueue } from "~/bestdori";
import { StatsSchema } from "~/schema";

const LEADERBOARD_STATS = [
	"hsr",
	"dtr",
	"allPerfectCount",
	"fullComboCount",
	"clearCount",
	"rank",
] as const;
export type LeaderboardStat = (typeof LEADERBOARD_STATS)[number];

const StatsResponse = z.strictObject({
	result: z.literal(true),
	accounts: z.array(
		z.strictObject({
			server: z.number().nonnegative(),
			titles: z.array(z.number().positive()).nonempty().optional(),
			...Object.fromEntries(
				[...LEADERBOARD_STATS, "uid" as const].map((key) => [
					key,
					z.number().nonnegative().optional(),
				]),
			),
		}),
	),
});

export const bestdoriStats = schemaTask({
	id: "bestdori-stats",
	queue: bestdoriQueue,
	schema: z.object({ username: z.string().nonempty() }),
	run: async ({ username }): Promise<Stat | null> => {
		await tags.add(`stats_${username}`);
		const { success, data, error } = StatsResponse.safeParse(
			await bestdori("api/user/sync", { username }),
		);

		if (!success) {
			await tags.add("schema_error");
			throw new AbortTaskRunError(error.message);
		}

		const stats =
			data.accounts
				.filter(({ server }) => server === 1)
				.map(
					(stat): Stat => ({
						highScoreRating: stat.hsr ?? null,
						bandRating: stat.dtr ?? null,
						allPerfectCount: stat.allPerfectCount ?? null,
						fullComboCount: stat.fullComboCount ?? null,
						clearCount: stat.clearCount ?? null,
						rank: stat.rank ?? null,
						titles: stat.titles ?? null,
					}),
				)
				.at(0) ?? null;

		const getStat = <K extends keyof Stat>(key: K) =>
			stats === null ? "unavailable" : stats[key];

		await tags.add([
			...STAT_COLUMNS.map(
				(column) =>
					`${ABBREVIATED_STAT_COLUMNS[column]}_${getStat(column) ?? "private"}`,
			),
			`titles_${getStat("titles")?.length ?? "private"}`,
		]);

		return StatsSchema.nullable().parse(stats);
	},
});
