import { register } from "discord-hono";

import { commands, factory } from "./commands";

const { DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN } = process.env;
if (!DISCORD_APPLICATION_ID || !DISCORD_BOT_TOKEN)
	throw new Error("Discord credentials are missing.");

const registerGlobal =
	process.argv[2] === "--global" || process.argv[2] === "-g";
register(
	factory.getCommands(commands),
	DISCORD_APPLICATION_ID,
	DISCORD_BOT_TOKEN,
	registerGlobal ? undefined : process.env.DISCORD_GUILD_ID,
);
