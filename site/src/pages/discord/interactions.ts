import type { APIRoute } from "astro";

import handle from "@bandori-stats/discord-bot";

export const POST: APIRoute = async ({ request, locals }) => {
	const { env } = await import("cloudflare:workers");
	return handle.fetch(
		request,
		{ cf: env, SITE_URL: new URL(request.url).origin },
		locals.cfContext,
	);
};
