import {
	ABBREVIATED_STAT_NAMES,
	STAT_NAMES,
	type Stats,
} from "@bandori-stats/bestdori/constants";
import { PlayerStats } from "@bandori-stats/bestdori/schema/player/stats";
import { AbortTaskRunError, schemaTask, tags } from "@trigger.dev/sdk/v3";
import z from "zod";

import { bestdori, bestdoriQueue } from "~/bestdori";
import { StatsSchema } from "~/schema";

export const bestdoriStats = schemaTask({
	id: "bestdori-stats",
	queue: bestdoriQueue,
	schema: z.object({ username: z.string().nonempty() }),
	run: async ({ username }): Promise<Stats | null> => {
		await tags.add(`stats_${username}`);
		const { success, data, error } = PlayerStats.safeParse(
			await bestdori("api/user/sync", { username }),
		);

		if (!success) {
			await tags.add("schema_error");
			throw new AbortTaskRunError(error.message);
		}

		const stats =
			data.accounts
				.filter(({ server }) => server === 1)
				.map(
					(stats): Stats => ({
						highScoreRating: stats.hsr ?? null,
						bandRating: stats.dtr ?? null,
						allPerfectCount: stats.allPerfectCount ?? null,
						fullComboCount: stats.fullComboCount ?? null,
						clearCount: stats.clearCount ?? null,
						rank: stats.rank ?? null,
						titles: stats.titles ?? null,
					}),
				)
				.at(0) ?? null;

		const getStat = <K extends keyof Stats>(key: K) =>
			stats === null ? "unavailable" : stats[key];

		await tags.add([
			...STAT_NAMES.map(
				(name) =>
					`${ABBREVIATED_STAT_NAMES[name]}_${getStat(name) ?? "private"}`,
			),
			`titles_${getStat("titles")?.length ?? "private"}`,
		]);

		return StatsSchema.nullable().parse(stats);
	},
});
