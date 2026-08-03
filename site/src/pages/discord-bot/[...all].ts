import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

import { createHandler } from "@bandori-stats/discord-bot";

const handleDiscordInteractions = createHandler("/discord-bot");
export const ALL: APIRoute = ({ request, locals }) => {
	return handleDiscordInteractions.fetch(request, env, locals.cfContext);
};
