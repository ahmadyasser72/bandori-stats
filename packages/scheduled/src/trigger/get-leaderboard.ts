import { logger, schemaTask } from "@trigger.dev/sdk";
import z from "zod";

import { bestdori } from "~/bestdori";
import type { LeaderboardStat } from "./get-stats";

const LEADERBOARD_LIMIT = 50;
export const LEADERBOARD_TYPES = [
	"high-score-rating",
	"band-rating",
	"all-perfect",
	"full-combo",
	"cleared",
	"rank",
] as const;

type LeaderboardType = (typeof LEADERBOARD_TYPES)[number];

const leaderboardTypeMap = {
	"high-score-rating": "hsr",
	"band-rating": "dtr",
	"all-perfect": "allPerfectCount",
	"full-combo": "fullComboCount",
	cleared: "clearCount",
	rank: "rank",
} satisfies Record<LeaderboardType, LeaderboardStat>;

interface LeaderboardResponse {
	rows: {
		user: {
			username: string;
		};
	}[];
}

export const getLeaderboard = schemaTask({
	id: "get-leaderboard",
	schema: z.object({ type: z.enum(LEADERBOARD_TYPES) }),
	run: async ({ type }) => {
		logger.debug("fetching leaderboard", { type });
		const results = await bestdori<LeaderboardResponse>(
			"api/sync/list/player",
			{
				server: "1",
				stats: leaderboardTypeMap[type],
				limit: LEADERBOARD_LIMIT.toString(),
				offset: "0",
			},
		);

		return results.rows.map((row) => row.user.username);
	},
});
