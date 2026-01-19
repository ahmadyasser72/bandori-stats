import { STAT_NAMES } from "@bandori-stats/bestdori/constants";
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
		for (const name of STAT_NAMES) {
			const scores = snapshots
				.filter(({ stats }) => !!stats[name])
				.map(({ accountId, stats }) => ({
					member: accountId,
					score: stats[name]!,
				}));

			if (scores.length > 0)
				// @ts-ignore
				p.zadd(`leaderboard:${date}:${name}`, ...scores);
		}
		await p.exec();

		const titles = snapshots.flatMap(({ stats }) => stats.titles ?? []);
		if (titles.length === 0) return;

		// @ts-ignore
		const addedTitles = await redis.sadd("leaderboard:titles", ...titles);
		if (addedTitles === 0) return;

		await tags.add(`titles_+${addedTitles}`);
		if (ctx.deployment?.git) {
			const { ghUsername, commitRef } = ctx.deployment.git;

			if (ghUsername && commitRef) {
				const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

				await tags.add("site_rebuild");
				await octokit.request(
					"POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
					{
						owner: ghUsername,
						repo: "bandori-stats",
						ref: commitRef,
						workflow_id: "deploy.yaml",
						headers: { "X-GitHub-Api-Version": "2022-11-28" },
					},
				);
			}
		}
	},
});
