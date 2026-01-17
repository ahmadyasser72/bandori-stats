import { STAT_NAMES } from "@bandori-stats/bestdori/constants";
import {
	ButtonStyleTypes,
	InteractionResponseFlags,
	InteractionResponseType,
	InteractionType,
	MessageComponentTypes,
	type MessageComponent,
} from "discord-interactions";
import { titleCase } from "text-case";

import { CommandOptionType, type Command, type CommandHandler } from "./types";

export const command = {
	name: "stats",
	description: "Get account stats",
	type: 1,
	contexts: [0, 1, 2],
	options: [
		{
			name: "username",
			description: "Bestdori! username",
			type: CommandOptionType.STRING,
			required: true,
			autocomplete: true,
		},
	],
} satisfies Command;

export const handle: CommandHandler = async ({ type, data }) => {
	const { db } = await import("@bandori-stats/database");

	switch (type) {
		case InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE: {
			const username = data.options
				?.find(({ name, focused }) => name === "username" && focused)
				?.value.toString();

			const accounts = await db.query.accounts.findMany({
				columns: { username: true, nickname: true },
				limit: 25,
				orderBy: { lastUpdated: "desc", username: "desc" },
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

		case InteractionType.MESSAGE_COMPONENT:
		case InteractionType.APPLICATION_COMMAND: {
			const username =
				type === InteractionType.APPLICATION_COMMAND
					? data.options
							?.find(({ name }) => name === "username")
							?.value.toString()
					: data.custom_id?.replace("select_date_", "");
			if (!username) return;

			const account = (await db.query.accounts.findFirst({
				columns: { nickname: true },
				where: { username },
				with: {
					snapshots: {
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
					? `# ${account.nickname} (@${username})`
					: `# @${username}`,
			});

			const current =
				type === InteractionType.APPLICATION_COMMAND
					? account.snapshots[0]
					: account.snapshots.find(
							(it) => it.snapshotDate === data.values?.at(0),
						);
			if (!current) return;

			components.push({
				type: MessageComponentTypes.TEXT_DISPLAY,
				content: `**Last updated**: \`${current.snapshotDate}\``,
			});
			components.push({ type: MessageComponentTypes.SEPARATOR });

			const numberFormatter = Intl.NumberFormat("en-US");
			components.push({
				type: MessageComponentTypes.TEXT_DISPLAY,
				content: STAT_NAMES.map((name) => {
					const value = current.stats[name];
					return `**${titleCase(name.replace("Count", ""))}**: ${value ? numberFormatter.format(value) : "N/A"}`;
				}).join("\n"),
			});

			if (current.stats.titles) {
				components.push({
					type: MessageComponentTypes.TEXT_DISPLAY,
					content: `**Titles unlocked**: ${current.stats.titles.length}`,
				});
			}

			components.push(
				{
					type: MessageComponentTypes.ACTION_ROW,
					components: [
						{
							type: MessageComponentTypes.BUTTON,
							style: ButtonStyleTypes.LINK,
							label: "Bestdori! Profile",
							url: `https://bestdori.com/community/user/${username}`,
						},
					],
				},
				{
					type: MessageComponentTypes.ACTION_ROW,
					components: [
						{
							type: MessageComponentTypes.STRING_SELECT,
							custom_id: `select_date_${username}`,
							options: account.snapshots.map(({ snapshotDate }) => ({
								label: snapshotDate,
								description:
									current.snapshotDate === snapshotDate
										? "(active)"
										: undefined,
								value: snapshotDate,
							})),
						},
					],
				},
			);

			return {
				type:
					type === InteractionType.APPLICATION_COMMAND
						? InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE
						: InteractionResponseType.UPDATE_MESSAGE,
				data: {
					flags: InteractionResponseFlags.IS_COMPONENTS_V2,
					components,
				},
			};
		}

		default:
			break;
	}
};
