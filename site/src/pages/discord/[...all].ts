import type { APIRoute } from "astro";

import handleDiscordInteractions from "@bandori-stats/discord-interactions/app";

export const ALL: APIRoute = ({ request, locals }) => {
	return handleDiscordInteractions.fetch(
		request,
		locals.runtime.env,
		locals.runtime.ctx,
	);
};
