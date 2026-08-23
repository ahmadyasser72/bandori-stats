import { schemaTask, tags } from "@trigger.dev/sdk";
import z from "zod";

import { STAT_NAMES } from "@bandori-stats/bestdori/constants";
import {
	PLAYER_STATS_SORTED_SET_PREFIX,
	PLAYER_TITLES_SET,
	redis,
} from "@bandori-stats/database/redis";
import { AccountSchema } from "~/schema";

const SnapshotSchema = z.strictObject({
	accountId: z.number().nonnegative(),
	stats: AccountSchema.shape.stats.unwrap(),
});

export const updateStatsRedis = schemaTask({
	id: "update-stats-redis",
	schema: z.strictObject({ snapshot: SnapshotSchema }),
	run: async ({ snapshot }) => {
		const { accountId, stats } = snapshot;

		await Promise.all(
			STAT_NAMES.map((stat) => {
				const score = stats[stat];
				if (score === null) return null;

				return redis().zadd(
					`${PLAYER_STATS_SORTED_SET_PREFIX}:${stat}`,
					{ gt: true, ch: true },
					{ member: accountId, score },
				);
			}),
		);

		const titles = stats.titles ?? [];
		if (titles.length === 0) return;

		// @ts-expect-error should works
		const newTitles = await redis().sadd(PLAYER_TITLES_SET, ...titles);
		if (newTitles === 0) return;

		await tags.add(`titles_+${newTitles}`);
	},
});
