import {
	STAT_NAMES,
	type RawStatName,
	type StatName,
} from "@bandori-stats/bestdori/constants";
import { PlayerLeaderboard } from "@bandori-stats/bestdori/schema/player/leaderboard";
import { AbortTaskRunError, schemaTask, tags } from "@trigger.dev/sdk";
import z from "zod";

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
		await tags.add(`leaderboard_${type}:${offset}-${offset + limit}`);
		const { success, data, error } = PlayerLeaderboard.safeParse(
			await bestdori("api/sync/list/player", {
				server: "1",
				stats: leaderboardTypeMap[type],
				limit: limit.toString(),
				offset: offset.toString(),
			}),
		);

		if (!success) {
			await tags.add("schema_error");
			throw new AbortTaskRunError(error.message);
		}

		if (offset === 0 && data.rows.length > 2) {
			await tags.add(
				Array.from(
					{ length: 5 },
					(_, idx) => `top${idx + 1}_${data.rows[idx]!.user.username}`,
				),
			);
		}

		return data.rows.map((row) => row.user);
	},
});
