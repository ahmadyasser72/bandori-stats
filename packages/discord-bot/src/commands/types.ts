import type {
	InteractionResponseFlags,
	InteractionResponseType,
	InteractionType,
	MessageComponent,
} from "discord-interactions";

// https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-structure
export interface Command {
	name: string;
	description: string;
	type: 1; // CHAT_INPUT
	contexts: (0 | 1 | 2)[]; // 0: GUILD, 1: BOT_DM, 2: PRIVATE_CHANNEL

	options: CommandOption[];
}

// https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure
export interface CommandOption {
	name: string;
	description: string;
	required?: boolean;
	choices?: { name: string; value: string | number }[];
	autocomplete?: boolean;

	type: CommandOptionType;
}

// https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-type
export enum CommandOptionType {
	SUB_COMMAND = 1,
	SUB_COMMAND_GROUP = 2,
	STRING = 3,
	INTEGER = 4,
	BOOLEAN = 5,
}

export interface CommandInteraction {
	type: InteractionType;
	data: {
		name: string;

		options?: (CommandOption & { focused: boolean; value: string | number })[];
		custom_id?: string;
		values?: string[];
	};
}
interface CommandInteractionResponse {
	type: InteractionResponseType;
	data?:
		| {
				flags: InteractionResponseFlags;
				components: MessageComponent[];
		  }
		| { choices: { name: string; value: string | number }[] }
		| { flags: InteractionResponseFlags; content: string };
}

export type CommandHandler = (
	payload: CommandInteraction,
) => Promise<CommandInteractionResponse>;
