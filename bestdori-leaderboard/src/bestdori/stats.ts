import { bestdori } from "./index.ts";

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

export const fetchStats = async (username: string) => {
	const result = await bestdori<StatsResponse>("api/user/sync", {
		username,
	});

	return (
		result.accounts
			.map((stat) => ({
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
};
