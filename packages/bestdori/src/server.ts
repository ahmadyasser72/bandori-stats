export const SERVERS = {
	JP: 0,
	EN: 1,
	TW: 2,
	CN: 3,
} as const;

export type GameServer = (typeof SERVERS)[keyof typeof SERVERS];

export const GAME_SERVER = SERVERS.EN;

export const SERVER_PATHS: Record<GameServer, string> = {
	[SERVERS.JP]: "jp",
	[SERVERS.EN]: "en",
	[SERVERS.TW]: "tw",
	[SERVERS.CN]: "cn",
} as const;

export const SERVER_NAMES: Record<GameServer, string> = {
	[SERVERS.JP]: "Japan",
	[SERVERS.EN]: "English",
	[SERVERS.TW]: "Taiwan",
	[SERVERS.CN]: "China",
} as const;
