import { tags, type TaskRunContext } from "@trigger.dev/sdk";

export const rebuildSite = async (ctx: TaskRunContext) => {
	if (!ctx.deployment?.git) return;

	const token = process.env.GITHUB_TOKEN;
	if (!token) return;

	const { ghUsername, commitRef } = ctx.deployment.git;

	await tags.add("site_rebuild");
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
};
