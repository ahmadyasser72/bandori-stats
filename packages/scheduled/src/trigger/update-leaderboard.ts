import { STAT_COLUMNS } from "@bandori-stats/database/constants";
import { redis } from "@bandori-stats/database/redis";
import { schemaTask, tags } from "@trigger.dev/sdk";
import z from "zod";

import { StatsSchema } from "~/schema";

const SnapshotSchema = z.strictObject({
	accountId: z.number().nonnegative(),
	stats: StatsSchema,
});

export const updateLeaderboard = schemaTask({
	id: "update-leaderboard",
	schema: z.strictObject({
		snapshots: z
			.union([SnapshotSchema, z.array(SnapshotSchema).nonempty()])
			.transform((it) => (Array.isArray(it) ? it : [it])),
		date: z.iso.date(),
	}),
	run: async ({ date, snapshots }) => {
		const p = redis.pipeline();
		for (const column of STAT_COLUMNS) {
			const key = `leaderboard:${date}:${column}`;
			const [score1, ...scores] = snapshots
				.filter(({ stats }) => !!stats[column])
				.map(({ accountId, stats }) => ({
					member: accountId,
					score: stats[column]!,
				}));
			p.zadd(key, score1!, ...scores);
		}
		await p.exec();

		const [title1, ...titles] = snapshots.flatMap(
			({ stats }) => stats.titles ?? [],
		);
		await redis.sadd("leaderboard:titles", title1!, ...titles);

		await tags.add(`leaderboard_${date}`);
	},
});
