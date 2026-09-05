import { useDiscordBot } from "~/discord";

await useDiscordBot(async ({ client }) => {
	const emojis = await client.application.emojis.fetch();
	console.log([...emojis.values()].map((emoji) => emoji.toString()));
});
