import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { fetchAllLeaderboard } from "./bestdori/leaderboard.ts";
import { fetchStats } from "./bestdori/stats.ts";

const app = new Hono();

const routes = app
	.get("/usernames", async (c) => {
		const usernames = await fetchAllLeaderboard();
		return c.json({ data: usernames }, 200);
	})
	.get(
		"/stats",
		zValidator(
			"query",
			z.object({
				username: z.union([
					z.array(z.string().nonempty()),
					z.string().nonempty(),
				]),
			}),
		),
		async (c) => {
			const { username } = c.req.valid("query");
			const stats = await Promise.all(
				(typeof username === "string" ? [username] : username).map(
					async (username) => {
						const stat = await fetchStats(username);
						return { username, stat };
					},
				),
			);

			return c.json({ data: stats });
		},
	);

export default app;
export type AppType = typeof routes;
