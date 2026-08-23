import { schemaTask } from "@trigger.dev/sdk";
import z from "zod";

import {
	STAT_NAMES,
	type RawStatName,
	type StatName,
} from "@bandori-stats/bestdori/constants";
import { PlayerLeaderboard } from "@bandori-stats/bestdori/schema/player/leaderboard";
import { bestdori, bestdoriQueue } from "~/bestdori";

const leaderboardTypeMap: Record<StatName, RawStatName> = {
	highScoreRating: "hsr",
	bandRating: "dtr",
	allPerfectCount: "allPerfectCount",
	fullComboCount: "fullComboCount",
	clearCount: "clearCount",
	rank: "rank",
};

export const bestdoriLeaderboard = schemaTask({
	id: "bestdori-leaderboard",
	queue: bestdoriQueue,
	schema: z.object({
		type: z.enum(STAT_NAMES),
		limit: z.number().min(20).max(50).default(50),
		offset: z.number().nonnegative().default(0),
	}),
	run: async ({ type, limit, offset }) => {
		const data = await bestdori({
			path: "api/sync/list/player",
			schema: PlayerLeaderboard,
			query: {
				server: "1",
				stats: leaderboardTypeMap[type],
				limit: limit.toString(),
				offset: offset.toString(),
			},
		});

		return data.rows.map((row) => row.user);
	},
});
