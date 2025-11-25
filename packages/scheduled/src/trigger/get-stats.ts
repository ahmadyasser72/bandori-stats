import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import z from "zod";

import { bestdori } from "~/bestdori";

export type LeaderboardStat =
	| "hsr"
	| "dtr"
	| "allPerfectCount"
	| "fullComboCount"
	| "clearCount"
	| "rank";

interface StatsResponse {
	accounts: ({
		server: number;
	} & Record<LeaderboardStat, number | undefined>)[];
}

export const getStats = schemaTask({
	id: "get-stats",
	schema: z.object({ username: z.string().nonempty() }),
	run: async ({ username }) => {
		logger.debug("fetching stats", { username });
		const result = await bestdori<StatsResponse>("api/user/sync", {
			username,
		});

		return (
			result.accounts
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
