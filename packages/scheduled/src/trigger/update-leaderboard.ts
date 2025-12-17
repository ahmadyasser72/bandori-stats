import { STAT_COLUMNS } from "@bandori-stats/database/constants";
import { redis } from "@bandori-stats/database/redis";
import { Octokit } from "@octokit/core";
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
	run: async ({ date, snapshots }, { ctx }) => {
		const p = redis.pipeline();
		for (const column of STAT_COLUMNS) {
			const scores = snapshots
				.filter(({ stats }) => !!stats[column])
				.map(({ accountId, stats }) => ({
					member: accountId,
					score: stats[column]!,
				}));
			// @ts-ignore
			p.zadd(`leaderboard:${date}:${column}`, ...scores);
		}
		await p.exec();

		const titles = snapshots.flatMap(({ stats }) => stats.titles ?? []);
		// @ts-ignore
		const addedTitles = await redis.sadd("leaderboard:titles", ...titles);

		if (addedTitles > 0 && !!ctx.environment.git?.ghUsername) {
			const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

			await octokit.request(
				"POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
				{
					owner: ctx.environment.git.ghUsername,
					repo: "bandori-stats",
					workflow_id: "deploy-cloudflare-worker",
					ref: "main",
					headers: { "X-GitHub-Api-Version": "2022-11-28" },
				},
			);
		}

		await tags.add(`leaderboard_${date}`);
	},
});
