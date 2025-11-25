import { logger, schemaTask } from "@trigger.dev/sdk";
import z from "zod";

import { bestdori } from "~/bestdori";
import type { LeaderboardStat } from "./get-stats";

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

export const getLeaderboard = schemaTask({
	id: "get-leaderboard",
	schema: z.object({
		type: z.enum(LEADERBOARD_TYPES),
		limit: z.number().min(20).max(50).default(50),
		offset: z.number().nonnegative().default(0),
	}),
	run: async ({ type, limit, offset }) => {
		logger.debug("fetching leaderboard", { type });
		const { rows } = LeaderboardResponse.parse(
			await bestdori("api/sync/list/player", {
				server: "1",
				stats: leaderboardTypeMap[type],
				limit: limit.toString(),
				offset: offset.toString(),
			}),
		);

		return rows.map((row) => row.user.username);
	},
});
