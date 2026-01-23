import { STAT_NAMES } from "@bandori-stats/bestdori/constants";
import {
	accountHasNickname,
	compareValue,
	displayValue,
	formatNumber,
	type StatValue,
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
import { getBorderCharacters, table } from "table";
import { titleCase } from "text-case";

import { CommandOptionType, type Command, type CommandHandler } from "./types";

export const command = {
	name: "compare-stats",
	description: "Compare stats between two accounts",
	type: 1,
	contexts: [0, 1, 2],
	options: [
		{
			name: "account_1",
			description: "First Bestdori! account",
			type: CommandOptionType.INTEGER,
			required: true,
			autocomplete: true,
		},
		{
			name: "account_2",
			description: "Second Bestdori! account",
			type: CommandOptionType.INTEGER,
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
				?.find(({ focused }) => focused)
				?.value?.toString();
			const other = Number(
				data.options?.find(({ focused }) => !focused)?.value,
			);

			const accounts = await db.query.accounts.findMany({
				columns: { id: true, username: true, nickname: true },
				limit: 25,
				orderBy: { lastUpdated: "desc", username: "asc" },
				where: {
					id: Number.isNaN(other) ? undefined : { ne: other },
					...(typed && {
						OR: [
							{ username: { like: `%${typed}%` } },
							{ nickname: { like: `%${typed}%` } },
						],
					}),
				},
			});

			return {
				type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
				data: {
					choices: accounts.map(({ id, username, nickname }) => {
						const hasNickname = accountHasNickname({ username, nickname });
						return {
							value: id,
							name: hasNickname ? `${nickname} (@${username})` : `@${username}`,
						};
					}),
				},
			};
		}

		case InteractionType.APPLICATION_COMMAND: {
			const accountIds = data.options
				?.filter(({ name }) => name.startsWith("account"))
				.map((it) => Number(it.value))
				.filter((value) => !Number.isNaN(value));

			if (!accountIds || accountIds.length !== 2) {
				return {
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						flags: InteractionResponseFlags.EPHEMERAL,
						content: "Please select two valid accounts.",
					},
				};
			}

			const accounts = await db.query.accounts.findMany({
				where: { id: { in: accountIds } },
				columns: { username: true },
				with: {
					snapshots: {
						columns: { stats: true, snapshotDate: true },
						orderBy: { snapshotDate: "desc" },
						limit: 1,
					},
				},
			});

			const [a, b] = accounts;
			if (!a || !b) {
				return {
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						flags: InteractionResponseFlags.EPHEMERAL,
						content: "One or more accounts is unavailable.",
					},
				};
			}

			const aSnapshot = a.snapshots[0];
			const bSnapshot = b.snapshots[0];
			if (!aSnapshot || !bSnapshot) {
				return {
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						flags: InteractionResponseFlags.EPHEMERAL,
						content: "One or more accounts have no snapshot.",
					},
				};
			}

			const container = ((): Container => {
				const aDate = aSnapshot.snapshotDate;
				const bDate = bSnapshot.snapshotDate;

				const components: MessageComponent[] = [
					{
						type: MessageComponentTypes.TEXT_DISPLAY,
						content: "# Comparing Accounts",
					},
					{
						type: MessageComponentTypes.TEXT_DISPLAY,
						content: `**${displayHeading(a.username, aDate)}** vs **${displayHeading(b.username, bDate)}**`,
					},
					{ type: MessageComponentTypes.SEPARATOR },
				];

				const aStats = aSnapshot.stats;
				const bStats = bSnapshot.stats;

				components.push({
					type: MessageComponentTypes.TEXT_DISPLAY,
					content: [
						"```text",
						table(
							[
								[
									"Stat",
									displayStatsHeader(a.username, aDate),
									displayStatsHeader(b.username, bDate),
								],
								...[...STAT_NAMES, "titles" as const].map((name) => {
									const label =
										name === "titles"
											? "Titles unlocked"
											: titleCase(name.replace("Count", ""));

									const aValue = aStats[name];
									const bValue = bStats[name];

									return [
										label,
										displayStatsColumn(aValue, bValue),
										displayStatsColumn(bValue, aValue),
									];
								}),
							],
							{
								border: getBorderCharacters("norc"),
								columnDefault: {
									alignment: "right",
									verticalAlignment: "middle",
									wrapWord: true,
									width: 10,
								},
								columns: { 0: { alignment: "left", width: 8 } },
							},
						),
						"```",
					].join("\n"),
				});

				components.push({
					type: MessageComponentTypes.ACTION_ROW,
					components: [
						{
							type: MessageComponentTypes.BUTTON,
							style: ButtonStyleTypes.LINK,
							label: `@${a.username} Profile`,
							url: `https://bestdori.com/community/user/${a.username}`,
						},
						{
							type: MessageComponentTypes.BUTTON,
							style: ButtonStyleTypes.LINK,
							label: `@${b.username} Profile`,
							url: `https://bestdori.com/community/user/${b.username}`,
						},
					] satisfies Button[],
				});

				return { type: MessageComponentTypes.CONTAINER, components };
			})();

			return {
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					flags: InteractionResponseFlags.IS_COMPONENTS_V2,
					components: [container],
				},
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

const displayHeading = (username: string, date: string) =>
	`@${username} (${date})`;

const displayStatsHeader = (username: string, date: string) =>
	[`@${username}`, date].join("\n");

const displayStatsColumn = (left: StatValue, right: StatValue) => {
	const delta = compareValue(left, right);
	if (delta === 0) return displayValue(left);

	return [
		displayValue(left),
		`(${formatNumber(delta, { autoCompact: true, positiveSign: true })})`,
	].join("\n");
};
