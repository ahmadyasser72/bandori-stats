import type { Region } from "@bandori-stats/bestdori/constants";

import { Redis } from "@upstash/redis";

const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN)
	throw new Error("Redis credentials are missing.");

export const redis = new Redis({
	url: UPSTASH_REDIS_REST_URL,
	token: UPSTASH_REDIS_REST_TOKEN,
});

export const PLAYER_TITLES_SET_PREFIX = "stats:player-titles";
export const PLAYER_STATS_SORTED_SET_PREFIX = "stats:player-stats";

export const getPlayerTitlesSet = (region: Region) =>
	`${PLAYER_TITLES_SET_PREFIX}:${region}`;
export const getPlayerStatsSortedSet = (region: Region, stat: string) =>
	`${PLAYER_STATS_SORTED_SET_PREFIX}:${region}:${stat}`;
