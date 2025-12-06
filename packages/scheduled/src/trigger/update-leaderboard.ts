import { STAT_COLUMNS } from "@bandori-stats/database/constants";
import { redis } from "@bandori-stats/database/redis";
import { schemaTask } from "@trigger.dev/sdk";
import z from "zod";

const snapshotSchema = z.strictObject({
	accountId: z.number().nonnegative(),
	...Object.fromEntries(
		STAT_COLUMNS.map((column) => [column, z.number().nullable()]),
	),
});

export const updateLeaderboard = schemaTask({
	id: "update-leaderboard",
	schema: z.strictObject({
		snapshots: z
			.union([snapshotSchema, z.array(snapshotSchema).nonempty()])
			.transform((it) => (Array.isArray(it) ? it : [it])),
		date: z.iso.date(),
	}),
	run: async ({ date, snapshots }) => {
		const p = redis.pipeline();

		for (const column of STAT_COLUMNS) {
			const key = `leaderboard:${date}:${column}`;
			for (const { accountId, ...stats } of snapshots) {
				const score = stats[column];
				if (!score) continue;

				p.zadd(key, { member: accountId, score });
			}
		}

		await p.exec();
	},
});
