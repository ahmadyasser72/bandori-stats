import type { APIRoute } from "astro";

import { createHandler } from "@bandori-stats/discord-bot";

const handleDiscordInteractions = createHandler("/discord-bot");
export const ALL: APIRoute = ({ request, locals }) => {
	return handleDiscordInteractions.fetch(
		request,
		locals.runtime.env,
		locals.runtime.ctx,
	);
};
