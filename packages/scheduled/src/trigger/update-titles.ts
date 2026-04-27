import { PLAYER_TITLES_SET, redis } from "@bandori-stats/database/redis";

import { Octokit } from "@octokit/core";
import { schemaTask, tags } from "@trigger.dev/sdk";
import z from "zod";

import { AccountSchema } from "~/schema";

const SnapshotSchema = z.strictObject({
	accountId: z.number().nonnegative(),
	stats: AccountSchema.shape.stats.unwrap(),
});

export const updateTitleSet = schemaTask({
	id: "update-title-set",
	schema: z.strictObject({
		snapshots: z
			.union([SnapshotSchema, z.array(SnapshotSchema).nonempty()])
			.transform((it) => (Array.isArray(it) ? it : [it])),
	}),
	run: async ({ snapshots }, { ctx }) => {
		const titles = snapshots.flatMap(({ stats }) => stats.titles ?? []);
		if (titles.length === 0) return;

		// @ts-expect-error should works
		const newTitles = await redis.sadd(PLAYER_TITLES_SET, ...titles);
		if (newTitles === 0) return;

		await tags.add(`titles_+${newTitles}`);
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
