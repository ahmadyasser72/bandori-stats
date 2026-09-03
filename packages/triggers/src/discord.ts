import { AbortTaskRunError } from "@trigger.dev/sdk";
import { Client, type Guild } from "discord.js";

export const useDiscordBot = async (
	use: (value: { client: Client; guild: Guild }) => Promise<void>,
) => {
	const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID } = process.env;
	if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID)
		throw new AbortTaskRunError("Discord credentials are missing.");

	const client = new Client({ intents: [] });
	await client.login(DISCORD_BOT_TOKEN);
	const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
	await use({ client, guild }).finally(() => client.destroy());
};
