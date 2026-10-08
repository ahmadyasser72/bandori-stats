import { commands, factory } from "./commands";

export default factory
	.discord({
		discordEnv: (env) => ({
			APPLICATION_ID: env?.DISCORD_APPLICATION_ID,
			PUBLIC_KEY: env?.DISCORD_PUBLIC_KEY,
			TOKEN: env?.DISCORD_BOT_TOKEN,
		}),
	})
	.loader(commands);
