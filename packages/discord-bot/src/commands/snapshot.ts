import { accountHasNickname } from "@bandori-stats/bestdori/helpers";
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

import dayjs from "../date";
import { CommandOptionType, type Command, type CommandHandler } from "./types";

export const command = {
	name: "snapshot",
	description: "Get account snapshot",
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
		{
			name: "date",
			description: "Snapshot date",
			type: CommandOptionType.STRING,
			autocomplete: true,
		},
		{
			name: "theme",
			description: "Card image theme",
			type: CommandOptionType.STRING,
			choices: [
				{ name: "Catppuccin Latte (light)", value: "latte" },
				{ name: "Catppuccin Mocha (dark)", value: "mocha" },
			],
		},

		{
			name: "full_combo_ratio",
			description: "Display Full Combo as a percentage of total clears.",
			type: CommandOptionType.BOOLEAN,
		},
		{
			name: "all_perfect_ratio",
			description: "Display All Perfect as a percentage of total clears.",
			type: CommandOptionType.BOOLEAN,
		},
	],
} satisfies Command;

export const handle: CommandHandler = async (request, { type, data }) => {
	const { db, and, eq, gt } = await import("@bandori-stats/database");

	switch (type) {
		case InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE: {
			const accountOption = data.options?.find(
				({ name }) => name === "account",
			);
			const dateOption = data.options?.find(({ name }) => name === "date");

			if (accountOption?.focused) {
				const typed = accountOption.value;
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
						choices: accounts.map(({ id, username, nickname }) => ({
							value: id,
							name: accountHasNickname({ username, nickname })
								? `${nickname} (@${username})`
								: `@${username}`,
						})),
					},
				};
			} else if (
				dateOption?.focused &&
				typeof accountOption?.value === "number"
			) {
				const typed = dateOption.value;
				const snapshots = await db.query.accountSnapshots.findMany({
					columns: { snapshotDate: true },
					limit: 25,
					where: {
						accountId: accountOption.value,
						...(typed && { snapshotDate: { like: `%${typed}%` } }),
					},
					orderBy: { snapshotDate: "desc" },
				});

				return {
					type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
					data: {
						choices: snapshots.map(({ snapshotDate }) => ({
							value: snapshotDate,
							name: `${snapshotDate} (${dayjs(snapshotDate).fromNow()})`,
						})),
					},
				};
			}

			return {
				type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
				data: { choices: [] },
			};
		}

		case InteractionType.MESSAGE_COMPONENT:
		case InteractionType.APPLICATION_COMMAND: {
			const {
				accountId = NaN,
				theme = "mocha",
				fullComboRatio = false,
				allPerfectRatio = false,
				page = 0,
			} = await (async () => {
				if (type === InteractionType.APPLICATION_COMMAND) {
					const accountId = Number(
						data.options?.find(({ name }) => name === "account")?.value,
					);
					const date = data.options
						?.find(({ name }) => name === "date")
						?.value?.toString();
					const theme = data.options
						?.find(({ name }) => name === "theme")
						?.value?.toString();
					const fullComboRatio = Boolean(
						data.options?.find(({ name }) => name === "full_combo_ratio")
							?.value,
					);
					const allPerfectRatio = Boolean(
						data.options?.find(({ name }) => name === "all_perfect_ratio")
							?.value,
					);

					let page = 0;
					if (date && !Number.isNaN(accountId)) {
						page = await db.$count(
							accountSnapshots,
							and(
								eq(accountSnapshots.accountId, accountId),
								gt(accountSnapshots.snapshotDate, date),
							),
						);
					}

					return { accountId, theme, fullComboRatio, allPerfectRatio, page };
				} else {
					const parts = data.custom_id!.replace("snapshot:", "").split(":");

					return {
						accountId: Number(parts[0]),
						theme: parts[1],
						fullComboRatio: !!parts[2],
						allPerfectRatio: !!parts[3],
						page: Number(parts[4]),
					};
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

			const queryOffset = Math.max(0, page - 1);
			const queryLimit = page === 0 ? 2 : 3;
			const account = await db.query.accounts.findFirst({
				columns: { username: true, nickname: true, uid: true },
				where: { id: accountId },
				with: {
					snapshots: {
						columns: { id: true, snapshotDate: true },
						orderBy: { snapshotDate: "desc" },
						limit: queryLimit,
						offset: queryOffset,
					},
				},
			});

			if (!account) {
				return {
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						flags: InteractionResponseFlags.EPHEMERAL,
						content: "Account not found.",
					},
				};
			}

			const currentSnapshot =
				page === 0 ? account.snapshots[0] : account.snapshots[1];
			const newerSnapshot = page > 0 ? account.snapshots[0] : undefined;
			const olderSnapshot =
				page === 0 ? account.snapshots[1] : account.snapshots[2];

			const container = ((): Container => {
				const components: MessageComponent[] = [];

				const hasNickname = accountHasNickname(account);
				components.push({
					type: MessageComponentTypes.TEXT_DISPLAY,
					content: hasNickname
						? `# ${account.nickname} (@${account.username})`
						: `# @${account.username}`,
				});

				components.push({
					type: MessageComponentTypes.TEXT_DISPLAY,
					content: `**Snapshot** @ ${currentSnapshot?.snapshotDate}`,
				});

				components.push({ type: MessageComponentTypes.SEPARATOR });

				components.push({
					type: MessageComponentTypes.MEDIA_GALLERY,
					items: currentSnapshot
						? [currentSnapshot].map(({ id, snapshotDate }) => {
								const image = new URL(
									`/history/items/${id}/card.png`,
									request.url,
								);
								image.searchParams.set("account", accountId.toString());
								image.searchParams.set("theme", theme);
								if (fullComboRatio)
									image.searchParams.append("ratio", "fullComboCount");
								if (allPerfectRatio)
									image.searchParams.append("ratio", "allPerfectCount");

								return {
									media: { url: image.href, height: 495, width: 727 },
									description: `@${account.username} stats @ ${snapshotDate}`,
								};
							})
						: [],
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

			const components: MessageComponent[] = [
				container,
				...((): MessageComponent[] => {
					const buttons: Button[] = [];

					if (olderSnapshot) {
						buttons.push({
							type: MessageComponentTypes.BUTTON,
							style: ButtonStyleTypes.SECONDARY,
							label: olderSnapshot.snapshotDate,
							emoji: { id: undefined, name: "⬅️" },
							custom_id: `snapshot:${accountId}:${theme}:${fullComboRatio || ""}:${allPerfectRatio || ""}:${page + 1}`,
						});
					}
					if (newerSnapshot) {
						buttons.push({
							type: MessageComponentTypes.BUTTON,
							style: ButtonStyleTypes.SECONDARY,
							label: newerSnapshot.snapshotDate,
							emoji: { id: undefined, name: "➡️" },
							custom_id: `snapshot:${accountId}:${theme}:${fullComboRatio || ""}:${allPerfectRatio || ""}:${page - 1}`,
						});
					}

					if (buttons.length > 0) {
						return [
							{ type: MessageComponentTypes.ACTION_ROW, components: buttons },
						];
					}

					return [];
				})(),
			];

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
