import { Redis } from "@upstash/redis";
import { allKeyed, mapValues, once, uniq } from "es-toolkit";
import type z from "zod";

import type {
	GameAreaItem,
	GameCharacterSituation,
} from "@bandori-stats/bestdori/schema/misc";
import type { TrackingReference, TrackingTarget } from "./schema/tracker";

export const redis = once(() => {
	const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
	if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN)
		throw new Error("Redis credentials are missing.");

	return new Redis({
		url: UPSTASH_REDIS_REST_URL,
		token: UPSTASH_REDIS_REST_TOKEN,
	});
});

export const PLAYER_TITLES_SET = "stats:player-titles";
export const PLAYER_STATS_SORTED_SET_PREFIX = "stats:player-stats";

export const GBP = {
	version: "gbp:version",
	maintenance: "gbp:maintenance",
	credentials: "gbp:credentials",
	credentialsRequest: "gbp:credentials:request",
	event: "gbp:event:current",
	monthly: "gbp:monthly:current",
	data: {
		AreaItem: "gbp:data:area-items",
		CharacterSituation: "gbp:data:character-situations",
	},

	from: (value: TrackingTarget | TrackingReference, suffix?: string) => {
		let kind: "event" | "monthly";
		let id: string;
		if ("kind" in value && "id" in value) {
			kind = value.kind;
			id = value.id.toString();
		} else {
			kind = value.trackingFor === "music" ? "event" : value.trackingFor;
			id =
				value.trackingFor === "music"
					? `${value.trackingEventId}:${value.trackingId}`
					: value.trackingId.toString();
		}

		const key = GBP[kind].replace("current", id);
		return suffix ? `${key}:${suffix}` : key;
	},
} as const;

export interface BangDreamCredentials {
	uid: number | string;
	token: string;
	signature: string;
}

export type BangDreamAreaItem = z.infer<typeof GameAreaItem>;
export type BangDreamCard = Omit<
	z.infer<typeof GameCharacterSituation>,
	"situationSkillId"
> & { skillId: number };

export const getRedisData = async (
	keys: Partial<Record<"areaItems" | "cards", (number | undefined)[]>>,
): Promise<{
	areaItems: Record<string, BangDreamAreaItem>;
	cards: Record<string, BangDreamCard>;
}> => {
	const ids = mapValues(keys, (ids) =>
		uniq(ids?.filter((id): id is number => !!id) ?? []).map((id) =>
			id.toString(),
		),
	);
	ids.areaItems ??= [];
	ids.cards ??= [];

	return allKeyed({
		areaItems:
			ids.areaItems.length > 0
				? redis()
						.hmget<Record<number, BangDreamAreaItem>>(
							GBP.data.AreaItem,
							...ids.areaItems,
						)
						.then((results) => results ?? {})
				: {},
		cards:
			ids.cards.length > 0
				? redis()
						.hmget<Record<number, BangDreamCard>>(
							GBP.data.CharacterSituation,
							...ids.cards,
						)
						.then((results) => results ?? {})
				: {},
	});
};

export const CHARACTER_TO_BAND: Record<string, number> = {
	// Poppin'Party
	1: 1,
	2: 1,
	3: 1,
	4: 1,
	5: 1,
	// Afterglow
	6: 2,
	7: 2,
	8: 2,
	9: 2,
	10: 2,
	// Hello, Happy World!
	11: 3,
	12: 3,
	13: 3,
	14: 3,
	15: 3,
	// Pastel*Palettes
	16: 4,
	17: 4,
	18: 4,
	19: 4,
	20: 4,
	// Roselia
	21: 5,
	22: 5,
	23: 5,
	24: 5,
	25: 5,
	// Morfonica
	26: 21,
	27: 21,
	28: 21,
	29: 21,
	30: 21,
	// RAISE A SUILEN
	31: 18,
	32: 18,
	33: 18,
	34: 18,
	35: 18,
	// MyGO!!!!!
	36: 45,
	37: 45,
	38: 45,
	39: 45,
	40: 45,
};
