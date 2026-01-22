import { STAT_NAMES } from "@bandori-stats/bestdori/constants";
import {
	accountHasNickname,
	displayValue,
} from "@bandori-stats/bestdori/helpers";

import {
	ButtonStyleTypes,
	InteractionResponseFlags,
	InteractionResponseType,
	InteractionType,
	MessageComponentTypes,
	type Button,
	type Container,
	type MessageComponent,
} from "discord-interactions";
import { titleCase } from "text-case";

import dayjs from "../date";
import { CommandOptionType, type Command, type CommandHandler } from "./types";

export const command = {
	name: "get-stats",
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
			const typed = data.options
				?.find(({ name, focused }) => name === "username" && focused)
				?.value.toString();

			const accounts = await db.query.accounts.findMany({
				columns: { username: true, nickname: true },
				limit: 25,
				orderBy: { lastUpdated: "desc", username: "asc" },
				where: typed
					? {
							OR: [
								{ username: { like: `%${typed}%` } },
								{ nickname: { like: `%${typed}%` } },
							],
						}
					: {},
			});

			return {
				type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
				data: {
					choices: accounts.map(({ username, nickname }) => {
						const hasNickname = accountHasNickname({ username, nickname });
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
					: data.custom_id?.replace("get-stats_select_date_", "");

			if (!username) {
				return {
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						flags: InteractionResponseFlags.EPHEMERAL,
						content: "Invalid account selected.",
					},
				};
			}

			const account = await db.query.accounts.findFirst({
				columns: { username: true, nickname: true, uid: true },
				where: { username },
				with: {
					snapshots: {
						columns: { stats: true, snapshotDate: true },
						limit: 26,
						orderBy: { snapshotDate: "desc" },
					},
				},
			});

			if (!account) {
				return {
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						flags: InteractionResponseFlags.EPHEMERAL,
						content: "Account not found",
					},
				};
			}

			const current =
				type === InteractionType.APPLICATION_COMMAND
					? account.snapshots[0]
					: account.snapshots.find(
							(it) => it.snapshotDate === data.values?.at(0),
						);

			if (!current) {
				return {
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						flags: InteractionResponseFlags.EPHEMERAL,
						content: "Snapshot not found",
					},
				};
			}

			const container = ((): Container => {
				const components: MessageComponent[] = [];

				const hasNickname = accountHasNickname(account);
				components.push({
					type: MessageComponentTypes.TEXT_DISPLAY,
					content: hasNickname
						? `# ${account.nickname} (@${username})`
						: `# @${username}`,
				});

				const timestamp = dayjs(current.snapshotDate).unix();
				components.push({
					type: MessageComponentTypes.TEXT_DISPLAY,
					content: `**Date**: <t:${timestamp}:d> (<t:${timestamp}:R>)`,
				});
				components.push({ type: MessageComponentTypes.SEPARATOR });

				components.push({
					type: MessageComponentTypes.TEXT_DISPLAY,
					content: [
						...STAT_NAMES.map((name) => {
							const value = current.stats[name];
							return `**${titleCase(name.replace("Count", ""))}**: ${displayValue(value)}`;
						}),
						`**Titles unlocked**: ${displayValue(current.stats.titles)}`,
					].join("\n"),
				});

				components.push({
					type: MessageComponentTypes.ACTION_ROW,
					components: ((): Button[] => {
						const buttons: Button[] = [
							{
								type: MessageComponentTypes.BUTTON,
								style: ButtonStyleTypes.LINK,
								label: "Bestdori! Profile",
								url: `https://bestdori.com/community/user/${username}`,
							},
						];

						if (account.uid) {
							buttons.push({
								type: MessageComponentTypes.BUTTON,
								style: ButtonStyleTypes.LINK,
								label: "Bestdori! Player Search",
								url: `https://bestdori.com/tool/playersearch/en/${account.uid}`,
							});
						}

						return buttons;
					})(),
				});

				return { type: MessageComponentTypes.CONTAINER, components };
			})();

			const components: MessageComponent[] = [container];

			if (account.snapshots.length > 1) {
				const latestSnapshotDate = account.snapshots[0]!.snapshotDate;

				components.push({
					type: MessageComponentTypes.ACTION_ROW,
					components: [
						{
							type: MessageComponentTypes.STRING_SELECT,
							custom_id: `get-stats_select_date_${username}`,
							placeholder: "Get stats on different date...",
							options: account.snapshots
								.filter((it) => it.snapshotDate !== current.snapshotDate)
								.map(({ snapshotDate }) => {
									const daysToNow = dayjs().diff(dayjs(snapshotDate), "days");
									const relativeTime =
										daysToNow === 0
											? "today"
											: daysToNow === 1
												? "yesterday"
												: dayjs(snapshotDate).fromNow();

									return {
										label: snapshotDate,
										description:
											snapshotDate === latestSnapshotDate
												? `(${relativeTime}, most recent)`
												: `(${relativeTime})`,
										value: snapshotDate,
									};
								}),
						},
					],
				});
			}

			return {
				type:
					type === InteractionType.APPLICATION_COMMAND
						? InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE
						: InteractionResponseType.UPDATE_MESSAGE,
				data: { flags: InteractionResponseFlags.IS_COMPONENTS_V2, components },
			};
		}

		default: {
			return {
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					flags: InteractionResponseFlags.EPHEMERAL,
					content: "Unsupported interaction",
				},
			};
		}
	}
};
