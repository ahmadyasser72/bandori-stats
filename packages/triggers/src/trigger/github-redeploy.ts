import { AbortTaskRunError, task } from "@trigger.dev/sdk";

export const githubRedeploy = task({
	id: "github-redeploy",
	run: async (_, { ctx }) => {
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
	},
});
