import type { APIRoute } from "astro";

import z from "zod";

import { TrackingTarget } from "@bandori-stats/database/tracker";

export const GET: APIRoute = async ({ locals, rewrite }) => {
	const { display, ...params } = locals.parseQuery(
		z.object({ ...TrackingTarget.shape, display: z.enum(["t10", "cutoffs"]) }),
	);

	const search = new URLSearchParams();
	search.set("id", params.id.toString());
	search.set("kind", params.kind);
	const response = await rewrite(`/tracker/list/${display}?${search}`);

	response.headers.set(
		"hx-replace-url",
		`/tracker?display=${display}&id=${params.id}&tab=${params.kind}`,
	);

	return response;
};
