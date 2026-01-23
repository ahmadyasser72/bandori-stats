import { command as compareStats } from "./commands/compare-stats";
import { command as getStats } from "./commands/get-stats";

const { DISCORD_APPLICATION_ID, DISCORD_APPLICATION_TOKEN } = process.env;
if (!DISCORD_APPLICATION_ID || !DISCORD_APPLICATION_TOKEN)
	throw new Error("Discord credentials are missing.");

const url = `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/commands`;
const commands = [compareStats, getStats];
const response = await fetch(url, {
	body: JSON.stringify(commands),
	method: "PUT",
	headers: {
		authorization: `Bot ${DISCORD_APPLICATION_TOKEN}`,
		"content-type": "application/json",
		"User-Agent":
			"DiscordBot (https://github.com/ahmadyasser72/bandori-stats, 1.0.0)",
	},
});

if (!response.ok) {
	const error = await response.text();
	throw new Error(error);
}

console.log(
	`Command registered`,
	commands.map(({ name }) => name),
);
