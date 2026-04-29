import { accountHasNickname } from "@bandori-stats/bestdori/helpers";
import { ComparisonChart, getGlobalMaxes } from "@bandori-stats/database/chart";

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
import QuickChart from "quickchart-js";

import dayjs from "../date";
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

		case InteractionType.MESSAGE_COMPONENT:
		case InteractionType.APPLICATION_COMMAND: {
			const { accountIds, targetDate } = (() => {
				if (type === InteractionType.APPLICATION_COMMAND) {
					return {
						accountIds: data.options
							?.filter(({ name }) => name.startsWith("account"))
							.map((it) => Number(it.value))
							.filter((value) => !Number.isNaN(value)),
						targetDate: dayjs().toISOString(),
					};
				} else {
					const [id1, id2, period, date] = data
						.custom_id!.replace("compare-stats_nav:", "")
						.split(":");

					let target = dayjs(date);
					if (period === "week") target = target.startOf("week");
					else if (period === "month") target = target.startOf("month");

					return {
						accountIds: [Number(id1), Number(id2)],
						targetDate: target.toISOString(),
					};
				}
			})();

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
				columns: { id: true, username: true },
				with: {
					snapshots: {
						columns: { stats: true, snapshotDate: true },
						orderBy: { snapshotDate: "desc" },
						where: {
							snapshotDate: { lte: dayjs(targetDate).format("YYYY-MM-DD") },
						},
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
						content: "One or more accounts have no snapshot for this period.",
					},
				};
			}

			const container = await (async (): Promise<Container> => {
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

				const chartUrl = await (async () => {
					const chart = new QuickChart();
					chart.setVersion("4");

					const maxStats = await getGlobalMaxes();
					chart.setConfig(
						ComparisonChart(
							{ username: a.username, snapshot: aSnapshot },
							{ username: b.username, snapshot: bSnapshot },
							maxStats,
						),
					);

					return chart.getShortUrl();
				})();

				components.push({
					type: MessageComponentTypes.MEDIA_GALLERY,
					items: [{ media: { url: chartUrl } }],
				});

				components.push({
					type: MessageComponentTypes.ACTION_ROW,
					components: [
						{
							type: MessageComponentTypes.BUTTON,
							style: ButtonStyleTypes.SECONDARY,
							label: "Latest",
							custom_id: `compare-stats_nav:${a.id}:${b.id}:latest:${dayjs().toISOString()}`,
						},
						{
							type: MessageComponentTypes.BUTTON,
							style: ButtonStyleTypes.SECONDARY,
							label: "-1 Week",
							custom_id: `compare-stats_nav:${a.id}:${b.id}:week:${dayjs(targetDate).subtract(1, "week").toISOString()}`,
						},
						{
							type: MessageComponentTypes.BUTTON,
							style: ButtonStyleTypes.SECONDARY,
							label: "-1 Month",
							custom_id: `compare-stats_nav:${a.id}:${b.id}:month:${dayjs(targetDate).subtract(1, "month").toISOString()}`,
						},
					],
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
				type:
					type === InteractionType.APPLICATION_COMMAND
						? InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE
						: InteractionResponseType.UPDATE_MESSAGE,
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
