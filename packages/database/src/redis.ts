import { Redis } from "@upstash/redis";

export const redis = () => {
	const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
	if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN)
		throw new Error("Redis credentials are missing.");

	return new Redis({
		url: UPSTASH_REDIS_REST_URL,
		token: UPSTASH_REDIS_REST_TOKEN,
	});
};

export const PLAYER_TITLES_SET = "stats:player-titles";
export const PLAYER_STATS_SORTED_SET_PREFIX = "stats:player-stats";

export const GAME_VERSION = "gbp:version";
export const GAME_EVENT_CURRENT = "gbp:event:current";
export const GAME_MONTHLY_CURRENT = "gbp:monthly:current";
