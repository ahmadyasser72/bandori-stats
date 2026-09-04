import { AbortTaskRunError, tags, type Context } from "@trigger.dev/sdk";

import { redis } from "@bandori-stats/database/redis";

const REDEPLOY_KEY = "github:redeploy";

export const githubRedeploy = async (ctx: Context) => {
	const deployedRecently = await redis().exists(REDEPLOY_KEY);
	if (deployedRecently) return;

	if (!ctx.deployment?.git)
		throw new AbortTaskRunError("No GitHub deployment context");

	const token = process.env.GITHUB_TOKEN;
	if (!token)
		throw new AbortTaskRunError("No GITHUB_TOKEN environment variable");

	const { ghUsername, commitRef } = ctx.deployment.git;
	await fetch(
		`https://api.github.com/repos/${ghUsername}/bandori-stats/actions/workflows/deploy.yaml/dispatches`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"X-GitHub-Api-Version": "2022-11-28",
			},
			body: JSON.stringify({ ref: commitRef }),
		},
	);

	await tags.add("github_redeploy");
	await redis().set(REDEPLOY_KEY, "", { ex: 60 * 30 });
};
