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
	],
} satisfies Command;

export const handle: CommandHandler = async (request, { type, data }) => {
	const { db, eq } = await import("@bandori-stats/database");

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
						.custom_id!.replace("snapshot_page:", "")
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

			const PAGE_SIZE = 4;
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
						columns: { id: true, snapshotDate: true },
						orderBy: { snapshotDate: "desc" },
						limit: PAGE_SIZE,
						offset: page * PAGE_SIZE,
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

				components.push({
					type: MessageComponentTypes.MEDIA_GALLERY,
					items: account.snapshots.map(({ id }) => ({
						media: {
							url: new URL(
								`/history/items/${id}/card.png?account=${accountId}`,
								request.url,
							).href,
						},
					})),
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
							label: "Newer",
							emoji: { id: undefined, name: "⬅️" },
							custom_id: `snapshot_page:${accountId}:${page - 1}`,
							disabled: page === 0,
						},
						{
							type: MessageComponentTypes.BUTTON,
							style: ButtonStyleTypes.SECONDARY,
							label: "Older",
							emoji: { id: undefined, name: "➡️" },
							custom_id: `snapshot_page:${accountId}:${page + 1}`,
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
