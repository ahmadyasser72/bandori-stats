import { commands, factory } from "./commands";

export default factory
	.discord({
		discordEnv: (env) => ({
			APPLICATION_ID: env?.cf.DISCORD_APPLICATION_ID,
			PUBLIC_KEY: env?.cf.DISCORD_PUBLIC_KEY,
			TOKEN: env?.cf.DISCORD_BOT_TOKEN,
		}),
	})
	.loader(commands);
