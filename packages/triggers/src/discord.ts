import { AbortTaskRunError, logger } from "@trigger.dev/sdk";
import { Client, type Guild } from "discord.js";
import { limitAsync } from "es-toolkit";

export const useDiscordBot = limitAsync(
	async (
		use: (value: { client: Client<true>; guild: Guild }) => Promise<void>,
	) =>
		logger.trace("discord-bot", async (span) => {
			{
				const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID } = process.env;
				if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID)
					throw new AbortTaskRunError("Discord credentials are missing.");

				const client = new Client({ intents: [] });
				await client.login(DISCORD_BOT_TOKEN);
				const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
				span.setAttribute?.("guild", guild.name);

				await new Promise((resolve) => {
					client.on("clientReady", (client) =>
						use({ client, guild }).finally(() =>
							client.destroy().then(resolve),
						),
					);
				});
			}
		}),
	1,
);
