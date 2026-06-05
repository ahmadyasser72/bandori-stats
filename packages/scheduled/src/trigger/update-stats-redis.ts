import {
	ABBREVIATED_STAT_NAMES,
	STAT_NAMES,
	type Region,
} from "@bandori-stats/bestdori/constants";
import {
	getPlayerStatsSortedSet,
	getPlayerTitlesSet,
	redis,
} from "@bandori-stats/database/redis";

import { Octokit } from "@octokit/core";
import { schemaTask, tags } from "@trigger.dev/sdk";
import z from "zod";

import { AccountSchema } from "~/schema";

const SnapshotSchema = z.strictObject({
	accountId: z.number().nonnegative(),
	region: z.enum(["JP", "EN", "CN"]),
	stats: AccountSchema.shape.stats.unwrap(),
});

export const updateStatsRedis = schemaTask({
	id: "update-stats-redis",
	schema: z.strictObject({ snapshot: SnapshotSchema }),
	run: async ({ snapshot }, { ctx }) => {
		const { accountId, region, stats } = snapshot;

		const newStatsBest = await Promise.all(
			STAT_NAMES.map((stat) => {
				const score = stats[stat];
				if (score === null) return null;

				return redis.zadd(getPlayerStatsSortedSet(region, stat), {
					gt: true,
					ch: true,
				}, { member: accountId, score });
			}),
		).then((results) =>
			results
				.map((value, idx) => ({ stat: STAT_NAMES[idx]!, value }))
				.filter(({ value }) => value !== null),
		);

		if (newStatsBest.length > 0)
			await tags.add(
				newStatsBest.map(
					({ stat }) => `${region}_${ABBREVIATED_STAT_NAMES[stat]}_NEW_HIGHEST`,
				),
			);

		const titles = stats.titles ?? [];
		if (titles.length === 0) return;

		// @ts-expect-error should works
		const newTitles = await redis.sadd(getPlayerTitlesSet(region), ...titles);
		if (newTitles === 0) return;

		await tags.add(`${region}_titles_+${newTitles}`);
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
