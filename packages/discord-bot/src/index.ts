import {
	InteractionResponseType,
	InteractionType,
	verifyKey,
} from "discord-interactions";
import { Hono } from "hono";

import type { CommandInteraction } from "./commands/types";

interface Bindings {
	DISCORD_APPLICATION_ID: string;
	DISCORD_APPLICATION_PUBLIC_KEY: string;
}

const app = new Hono<{ Bindings: Bindings }>()
	.get("/invite", (c) => {
		return c.redirect(
			`https://discord.com/oauth2/authorize?client_id=${c.env.DISCORD_APPLICATION_ID}`,
		);
	})
	.post("/interactions", async (c) => {
		const signature = c.req.header("X-Signature-Ed25519") ?? "";
		const timestamp = c.req.header("X-Signature-Timestamp") ?? "";
		const body = await c.req.text();
		const key = c.env.DISCORD_APPLICATION_PUBLIC_KEY;

		const isValidRequest = await verifyKey(body, signature, timestamp, key);
		if (!isValidRequest) return c.text("Invalid signature", 401);

		const interaction: CommandInteraction = JSON.parse(body);
		if (interaction.type === InteractionType.PING)
			return c.json({ type: InteractionResponseType.PONG });

		if (
			interaction.data.name === "get-stats" ||
			interaction.data.custom_id?.startsWith("get-stats_")
		) {
			const { handle } = await import("./commands/get-stats");
			const response = await handle(interaction);
			return c.json(response);
		}
	});

export const createHandler = (base: string) => new Hono().route(base, app);
