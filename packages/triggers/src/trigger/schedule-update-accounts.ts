import { schedules, wait } from "@trigger.dev/sdk";

import {
	GBP_TIMEZONE,
	STAT_NAMES,
	type RawStatName,
	type StatName,
} from "@bandori-stats/bestdori/constants";
import { PlayerLeaderboard } from "@bandori-stats/bestdori/schema/player/leaderboard";
import { db } from "@bandori-stats/database";
import { accounts } from "@bandori-stats/database/schema";
import { bestdori } from "~/bestdori";

const fetchLeaderboard = (() => {
	const leaderboardTypeMap: Record<StatName, RawStatName> = {
		highScoreRating: "hsr",
		bandRating: "dtr",
		allPerfectCount: "allPerfectCount",
		fullComboCount: "fullComboCount",
		clearCount: "clearCount",
		rank: "rank",
	};

	return async (type: StatName, limit: number, offset: number) => {
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
	};
})();

export const scheduleUpdateAccounts = schedules.task({
	id: "schedule-update-accounts",
	cron: {
		pattern: "0 0 1 * *",
		timezone: GBP_TIMEZONE,
	},
	run: async () => {
		const parameters = Array.from({ length: 4 }).flatMap((_, page) =>
			STAT_NAMES.map((type) => [type, 50, page * 50] as const),
		);

		const waitDuration = (4.5 * 60) / parameters.length;
		const values = [] as { username: string; nickname: string | null }[];
		for (const params of parameters) {
			await wait.for({ seconds: waitDuration });
			const results = await fetchLeaderboard(...params);
			values.push(...results);
		}
		if (values.length === 0) return;

		const upsertAccount = ({
			username,
			nickname,
		}: Awaited<ReturnType<typeof fetchLeaderboard>>[number]) =>
			db()
				.insert(accounts)
				.values({ username, nickname })
				.onConflictDoUpdate({ target: accounts.username, set: { nickname } });

		await db().batch([
			upsertAccount(values[0]),
			...values.slice(1).map(upsertAccount),
		]);
	},
});
