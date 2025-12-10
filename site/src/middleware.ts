import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(
	async ({ isPrerendered, url }, next) => {
		const response = await next();
		if (!isPrerendered && url.pathname.startsWith("/leaderboard")) {
			response.headers.set(
				"cache-control",
				"max-age=3600, stale-while-revalidate=60",
			);
		}

		return response;
	},
);
