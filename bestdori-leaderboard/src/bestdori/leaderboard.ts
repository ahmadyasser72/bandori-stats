import { LEADERBOARD_LIMIT } from "~/constants.ts";
import { bestdori } from "./index.ts";
import { LeaderboardStat } from "./stats.ts";

type LeaderboardType =
	| "high-score-rating"
	| "band-rating"
	| "all-perfect"
	| "full-combo"
	| "cleared"
	| "rank";

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

export const fetchLeaderboard = async (type: LeaderboardType) => {
	const results = await bestdori<LeaderboardResponse>("api/sync/list/player", {
		server: "1",
		stats: leaderboardTypeMap[type],
		limit: LEADERBOARD_LIMIT.toString(),
		offset: "0",
	});

	return results.rows.map((row) => row.user.username);
};

export const fetchAllLeaderboard = async () => {
	const types = Object.keys(leaderboardTypeMap) as LeaderboardType[];
	const usernames = (await Promise.all(types.map(fetchLeaderboard))).flat();

	return [...new Set(usernames)];
};
