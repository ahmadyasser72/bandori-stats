import { register } from "discord-hono";

import { commands, factory } from "./commands";

register(
	factory.getCommands(commands),
	process.env.DISCORD_APPLICATION_ID,
	process.env.DISCORD_BOT_TOKEN,
	process.env.DISCORD_GUILD_ID,
);
