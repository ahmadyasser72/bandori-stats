import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(
	async ({ isPrerendered, url }, next) => {
		const response = await next();
		if (!isPrerendered && url.pathname.startsWith("/leaderboard")) {
			response.headers.set(
				"cache-control",
				"max-age=60, stale-while-revalidate=3600",
			);
		}

		return response;
	},
);
