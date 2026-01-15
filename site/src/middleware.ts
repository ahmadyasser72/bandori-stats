import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(
	async ({ isPrerendered, routePattern }, next) => {
		const response = await next();
		if (
			!isPrerendered &&
			(routePattern.startsWith("/leaderboard") ||
				routePattern.startsWith("/history"))
		) {
			response.headers.set(
				"cache-control",
				"max-age=60, stale-while-revalidate=3600",
			);
		}

		return response;
	},
);
