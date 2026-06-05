import { createHandler } from "@bandori-stats/discord-bot";

import type { APIRoute } from "astro";

const handleDiscordInteractions = createHandler("/discord-bot");
export const ALL: APIRoute = ({ request, locals }) => {
	return handleDiscordInteractions.fetch(
		request,
		locals.runtime.env,
		locals.runtime.ctx,
	);
};
