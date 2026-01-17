import { STAT_NAMES } from "@bandori-stats/bestdori/constants";
import { db } from "@bandori-stats/database";
import {
	InteractionResponseFlags,
	InteractionResponseType,
	InteractionType,
	MessageComponentTypes,
	type MessageComponent,
} from "discord-interactions";

import { CommandOptionType, type Command, type CommandHandler } from "./types";

export const command = {
	name: "stats",
	description: "Get account stats",
	type: 1,
	options: [
		{
			name: "username",
			description: "Account username",
			type: CommandOptionType.STRING,
			required: true,
			autocomplete: true,
		},
	],
} satisfies Command;

export const handle: CommandHandler = async ({ type, data }) => {
	switch (type) {
		case InteractionType.APPLICATION_COMMAND: {
			const username = data.options
				.find(({ name }) => name === "username")!
				.value.toString();

			const account = (await db.query.accounts.findFirst({
				columns: { nickname: true },
				where: { username },
				with: {
					snapshots: {
						limit: 1,
						columns: { stats: true, snapshotDate: true },
						orderBy: { snapshotDate: "desc" },
					},
				},
			}))!;

			const components = [] as MessageComponent[];

			const hasNickname = account.nickname && username !== account.nickname;
			components.push({
				type: MessageComponentTypes.TEXT_DISPLAY,
				content: hasNickname
					? [`# ${account.nickname}`, `## @${username}`].join("\n")
					: `# @${username}`,
			});

			components.push({ type: MessageComponentTypes.SEPARATOR });

			const stats = account.snapshots[0]?.stats;
			if (stats) {
				const numberFormatter = Intl.NumberFormat("en-US");
				components.push({
					type: MessageComponentTypes.TEXT_DISPLAY,
					content: STAT_NAMES.map((name) => {
						const value = stats[name];
						return `**${name}**: ${value ? numberFormatter.format(value) : "N/A"}`;
					}).join("\n"),
				});

				if (stats.titles) {
					components.push({
						type: MessageComponentTypes.TEXT_DISPLAY,
						content: `**Titles unlocked**: ${stats.titles.length}`,
					});
				}
			}

			return {
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					flags: InteractionResponseFlags.IS_COMPONENTS_V2,
					components,
				},
			};
		}

		case InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE: {
			const username = data.options
				.find(({ name, focused }) => name === "username" && focused)
				?.value.toString();

			const accounts = await db.query.accounts.findMany({
				columns: { username: true, nickname: true },
				limit: 25,
				where: username
					? {
							OR: [
								{ username: { like: `%${username}%` } },
								{ nickname: { like: `%${username}%` } },
							],
						}
					: {},
			});

			return {
				type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
				data: {
					choices: accounts.map(({ username, nickname }) => {
						const hasNickname = nickname && username !== nickname;
						return {
							value: username,
							name: hasNickname ? `${nickname} (@${username})` : `@${username}`,
						};
					}),
				},
			};
		}

		default:
			break;
	}
};
