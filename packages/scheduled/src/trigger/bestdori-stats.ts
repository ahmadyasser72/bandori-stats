import {
	ABBREVIATED_STAT_NAMES,
	STAT_NAMES,
} from "@bandori-stats/bestdori/constants";
import { displayValue } from "@bandori-stats/bestdori/helpers";
import { PlayerStats } from "@bandori-stats/bestdori/schema/player/stats";

import { AbortTaskRunError, schemaTask, tags } from "@trigger.dev/sdk/v3";
import z from "zod";

import { bestdori, bestdoriQueue } from "~/bestdori";
import { AccountSchema } from "~/schema";

export const bestdoriStats = schemaTask({
	id: "bestdori-stats",
	queue: bestdoriQueue,
	schema: z.object({ username: z.string().nonempty() }),
	run: async ({ username }) => {
		await tags.add(`stats_${username}`);
		const { success, data, error } = PlayerStats.safeParse(
			await bestdori("api/user/sync", { username }),
		);

		if (!success) {
			await tags.add("schema_error");
			throw new AbortTaskRunError(error.message);
		}

		const { uid, stats } = data.accounts
			.filter(({ server }) => server === 1)
			.map((stats) => ({
				uid: stats.uid?.toString() ?? null,
				stats: {
					highScoreRating: stats.hsr ?? null,
					bandRating: stats.dtr ?? null,
					allPerfectCount: stats.allPerfectCount ?? null,
					fullComboCount: stats.fullComboCount ?? null,
					clearCount: stats.clearCount ?? null,
					rank: stats.rank ?? null,
					titles: stats.titles ?? null,
				},
			}))
			.at(0) ?? { uid: null, stats: null };

		await tags.add([
			...STAT_NAMES.map(
				(name) =>
					`${ABBREVIATED_STAT_NAMES[name]}_${displayValue(stats?.[name])}`,
			),
			`titles_${displayValue(stats?.titles?.length)}`,
			`uid_${displayValue(uid)}`,
		]);

		return AccountSchema.parse({ uid, stats });
	},
});
