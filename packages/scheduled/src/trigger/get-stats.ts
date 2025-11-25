import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import z from "zod";

import { bestdori } from "~/bestdori";

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
		z
			.strictObject({
				server: z.number().nonnegative(),
			})
			.and(
				z.record(
					z.enum(LEADERBOARD_STATS),
					z.number().nonnegative().optional(),
				),
			),
	),
});

export const getStats = schemaTask({
	id: "get-stats",
	schema: z.object({ username: z.string().nonempty() }),
	run: async ({ username }) => {
		logger.debug("fetching stats", { username });
		const { accounts } = StatsResponse.parse(
			await bestdori("api/user/sync", { username }),
		);

		return (
			accounts
				.map((stat) => ({
					username,
					server: stat.server,
					highScoreRating: stat.hsr ?? null,
					bandRating: stat.dtr ?? null,
					allPerfectCount: stat.allPerfectCount ?? null,
					fullComboCount: stat.fullComboCount ?? null,
					clearCount: stat.clearCount ?? null,
					rank: stat.rank ?? null,
				}))
				.find(({ server }) => server === 1) ?? null
		);
	},
});
