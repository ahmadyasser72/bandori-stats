import type { APIRoute } from "astro";

import z from "zod";

import { TrackingTarget } from "@bandori-stats/database/tracker";

export const DisplaySchema = z.enum(["t10", "t10-recent", "cutoffs"]);

export const GET: APIRoute = async ({ locals, rewrite }) => {
	const { display, ...params } = locals.parseQuery(
		z.object({ ...TrackingTarget.shape, display: DisplaySchema }),
	);

	const search = new URLSearchParams();
	search.set("id", params.id.toString());
	search.set("kind", params.kind);
	if (params.music) search.set("music", params.music.toString());
	const response = await rewrite(
		params.music
			? `/tracker/${display}-music?${search}`
			: `/tracker/${display}?${search}`,
	);

	response.headers.set(
		"hx-replace-url",
		params.music
			? `/tracker?display=${display}&id=${params.id}&music=${params.music}&tab=${params.kind}`
			: `/tracker?display=${display}&id=${params.id}&tab=${params.kind}`,
	);

	return response;
};
