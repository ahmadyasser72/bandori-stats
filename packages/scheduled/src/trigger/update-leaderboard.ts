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
			for (const { accountId, stats } of snapshots) {
				const score = stats[column];
				if (!score) continue;

				p.zadd(key, { member: accountId, score });
			}
		}

		await p.exec();
		await tags.add(`leaderboard_${date}`);
	},
});
