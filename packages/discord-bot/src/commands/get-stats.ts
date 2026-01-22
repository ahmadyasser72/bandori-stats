import { STAT_NAMES } from "@bandori-stats/bestdori/constants";
import {
	accountHasNickname,
	compareValue,
	displayValue,
	formatNumber,
} from "@bandori-stats/bestdori/helpers";
import { eq } from "@bandori-stats/database";
import { accountSnapshots } from "@bandori-stats/database/schema";

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

import dayjs from "../date";
import { CommandOptionType, type Command, type CommandHandler } from "./types";

export const command = {
	name: "get-stats",
	description: "Get account stats",
	type: 1,
	contexts: [0, 1, 2],
	options: [
		{
			name: "account",
			description: "Bestdori! account",
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
				?.find(({ name, focused }) => name === "account" && focused)
				?.value.toString();

			const accounts = await db.query.accounts.findMany({
				columns: { id: true, username: true, nickname: true },
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
			const { accountId = NaN, page = 0 } = (() => {
				if (type === InteractionType.APPLICATION_COMMAND) {
					return {
						accountId: Number(
							data.options?.find(({ name }) => name === "account")?.value,
						),
					};
				} else {
					const [accountId, page] = data
						.custom_id!.replace("get-stats_page:", "")
						.split(":")
						.map(Number);

					return { accountId, page };
				}
			})();

			if (Number.isNaN(accountId)) {
				return {
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						flags: InteractionResponseFlags.EPHEMERAL,
						content: "Invalid account selected.",
					},
				};
			}

			const PAGE_SIZE = 2;
			const account = await db.query.accounts.findFirst({
				columns: { username: true, nickname: true, uid: true },
				where: { id: accountId },
				extras: {
					snapshotsCount: db.$count(
						accountSnapshots,
						eq(accountSnapshots.accountId, accountId),
					),
				},
				with: {
					snapshots: {
						columns: { stats: true, snapshotDate: true },
						orderBy: { snapshotDate: "desc" },
						limit: PAGE_SIZE + 1,
						offset: page * PAGE_SIZE,
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

			const container = ((): Container => {
				const components: MessageComponent[] = [];

				const hasNickname = accountHasNickname(account);
				components.push({
					type: MessageComponentTypes.TEXT_DISPLAY,
					content: hasNickname
						? `# ${account.nickname} (@${account.username})`
						: `# @${account.username}`,
				});

				const totalPages = Math.ceil(account.snapshotsCount / PAGE_SIZE);
				components.push({
					type: MessageComponentTypes.TEXT_DISPLAY,
					content: `**Snapshots**: ${
						account.snapshots.at(0)?.snapshotDate ?? "—"
					}, ${
						account.snapshots.at(-1)?.snapshotDate ?? "—"
					} (page ${page + 1}/${totalPages})`,
				});

				components.push({ type: MessageComponentTypes.SEPARATOR });

				const snapshots = account.snapshots.slice(0, PAGE_SIZE);
				components.push({
					type: MessageComponentTypes.TEXT_DISPLAY,
					content: [
						"```text",
						table(
							[
								[
									"Stat",
									...snapshots.map(({ snapshotDate }) =>
										[
											snapshotDate,
											`(${formatRelativeTime(snapshotDate)})`,
										].join("\n"),
									),
								],
								...[...STAT_NAMES, "titles" as const].map((name) => [
									name === "titles"
										? "Titles unlocked"
										: titleCase(name.replace("Count", "")),
									...snapshots.map(({ stats }, idx) => {
										const current = stats[name];
										const previous = account.snapshots.at(idx + 1)?.stats[name];

										const delta = compareValue(current, previous);
										if (delta === 0) return displayValue(current);

										return [
											displayValue(current),
											`(+${formatNumber(delta, true)})`,
										].join("\n");
									}),
								]),
							],
							{
								border: getBorderCharacters("norc"),
								columnDefault: {
									alignment: "right",
									verticalAlignment: "middle",
									wrapWord: true,
									width: 10,
								},
								columns: { 0: { width: 8, alignment: "left" } },
							},
						),
						"```",
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
								url: `https://bestdori.com/community/user/${account.username}`,
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

			if (account.snapshotsCount > PAGE_SIZE) {
				const totalPages = Math.ceil(account.snapshotsCount / PAGE_SIZE);

				components.push({
					type: MessageComponentTypes.ACTION_ROW,
					components: [
						{
							type: MessageComponentTypes.BUTTON,
							style: ButtonStyleTypes.SECONDARY,
							label: "⬅ Newer",
							custom_id: `get-stats_page:${accountId}:${page - 1}`,
							disabled: page === 0,
						},
						{
							type: MessageComponentTypes.BUTTON,
							style: ButtonStyleTypes.SECONDARY,
							label: "Older ➡",
							custom_id: `get-stats_page:${accountId}:${page + 1}`,
							disabled: page + 1 >= totalPages,
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

const formatRelativeTime = (date: string) => {
	const daysToNow = dayjs().diff(dayjs(date), "days");
	if (daysToNow === 0) return "today";
	else if (daysToNow === 1) return "yesterday";
	else return dayjs(date).fromNow();
};
