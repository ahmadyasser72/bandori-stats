import {
	ABBREVIATED_STAT_COLUMNS,
	STAT_COLUMNS,
} from "@bandori-stats/database/constants";
import { AbortTaskRunError, schemaTask, tags } from "@trigger.dev/sdk/v3";
import z from "zod";

import { bestdori, bestdoriQueue } from "~/bestdori";

const LEADERBOARD_STATS = [
	"hsr",
	"dtr",
	"allPerfectCount",
	"fullComboCount",
	"clearCount",
	"rank",
] as const;
export type LeaderboardStat = (typeof LEADERBOARD_STATS)[number];

const statValue = z.number().nonnegative().optional();
const StatsResponse = z.strictObject({
	result: z.literal(true),
	accounts: z.array(
		z.strictObject({
			server: z.number().nonnegative(),
			uid: statValue,
			hsr: statValue,
			dtr: statValue,
			allPerfectCount: statValue,
			fullComboCount: statValue,
			clearCount: statValue,
			rank: statValue,
			titles: z.array(z.number().nonnegative()).optional(),
		}),
	),
});

export const bestdoriStats = schemaTask({
	id: "bestdori-stats",
	queue: bestdoriQueue,
	schema: z.object({ username: z.string().nonempty() }),
	run: async ({ username }) => {
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
				.map((stat) => ({
					server: stat.server,
					highScoreRating: stat.hsr ?? null,
					bandRating: stat.dtr ?? null,
					allPerfectCount: stat.allPerfectCount ?? null,
					fullComboCount: stat.fullComboCount ?? null,
					clearCount: stat.clearCount ?? null,
					rank: stat.rank ?? null,
				}))
				.find(({ server }) => server === 1) ?? null;

		await tags.add(
			STAT_COLUMNS.map(
				(column) =>
					`${ABBREVIATED_STAT_COLUMNS[column]}_${stats === null ? "unavailable" : (stats[column] ?? "private")}`,
			),
		);

		return stats;
	},
});
