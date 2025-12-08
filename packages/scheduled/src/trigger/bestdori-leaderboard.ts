import { STAT_COLUMNS, type StatName } from "@bandori-stats/database/constants";
import { AbortTaskRunError, schemaTask, tags } from "@trigger.dev/sdk";
import z from "zod";

import { bestdori, bestdoriQueue } from "~/bestdori";
import type { LeaderboardStat } from "./bestdori-stats";

const leaderboardTypeMap: Record<StatName, LeaderboardStat> = {
	highScoreRating: "hsr",
	bandRating: "dtr",
	allPerfectCount: "allPerfectCount",
	fullComboCount: "fullComboCount",
	clearCount: "clearCount",
	rank: "rank",
};

const LeaderboardResponse = z.strictObject({
	result: z.literal(true),
	count: z.number().nonnegative(),
	rows: z.array(
		z.strictObject({
			user: z.strictObject({
				username: z.string().nonempty(),
				nickname: z.string().nonempty().nullable(),
			}),
			stats: z.number().nonnegative(),
		}),
	),
});

export const bestdoriLeaderboard = schemaTask({
	id: "bestdori-leaderboard",
	queue: bestdoriQueue,
	schema: z.object({
		type: z.enum(STAT_COLUMNS),
		limit: z.number().min(20).max(50).default(50),
		offset: z.number().nonnegative().default(0),
	}),
	run: async ({ type, limit, offset }) => {
		await tags.add(`leaderboard_${type}:${offset}-${offset + limit}`);
		const { success, data, error } = LeaderboardResponse.safeParse(
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
