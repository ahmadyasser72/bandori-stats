import { Redis } from "@upstash/redis";
import { mapValues, once, uniq } from "es-toolkit";
import type z from "zod";

import type {
	GameAreaItem,
	GameCharacterSituation,
} from "@bandori-stats/bestdori/schema/misc";
import type { TrackingTarget } from "./schema/tracker";

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

type Id<P extends string, F extends string> = `${P}:${number | F}` | P;
const idProxy = <Prefix extends string, Fallback extends string>(
	prefix: Prefix,
	fallback?: Fallback,
) =>
	new Proxy({} as Record<number | Fallback, Id<Prefix, Fallback>>, {
		get: (_target, prop): Id<Prefix, Fallback> => {
			const id = Number(prop);
			if (Number.isInteger(id) && id > 0) return `${prefix}:${id}`;

			return fallback ? `${prefix}:${fallback}` : prefix;
		},
	});

export const GBP = {
	version: "gbp:version",
	maintenance: "gbp:maintenance",
	credentials: "gbp:credentials",
	event: idProxy("gbp:event", "current"),
	monthly: idProxy("gbp:monthly", "current"),
	data: {
		AreaItem: idProxy("gbp:data:area-items"),
		CharacterSituation: idProxy("gbp:data:character-situations"),
	},

	fromMetadata: (
		{ kind, id }: TrackingTarget,
		...suffix: (string | number)[]
	) => {
		const key = GBP[kind][id];
		return suffix.length > 0 ? [key, ...suffix].join(":") : key;
	},
} as const;

export interface BangDreamCredentials {
	uid: number;
	token?: string;
	signature: string;
}

export type BangDreamAreaItem = z.infer<typeof GameAreaItem>;
export type BangDreamCard = Omit<
	z.infer<typeof GameCharacterSituation>,
	"situationSkillId"
> & { skillId: number };

export const getRedisData = async (
	keys: Partial<Record<"areaItems" | "cards", (number | undefined)[]>>,
) => {
	const ids = mapValues(keys, (ids) =>
		uniq(ids?.filter((id): id is number => !!id) ?? []),
	);
	ids.areaItems ??= [];
	ids.cards ??= [];

	const results = await redis().mget(
		...ids.areaItems.map((id) => GBP.data.AreaItem[id]),
		...ids.cards.map((id) => GBP.data.CharacterSituation[id]),
	);

	const areaItems = new Map<number, BangDreamAreaItem>();
	const cards = new Map<number, BangDreamCard>();
	for (const [idx, data] of results.entries()) {
		const isAreaItem = idx < ids.areaItems.length;
		const id = isAreaItem
			? ids.areaItems[idx]
			: ids.cards[idx - ids.areaItems.length];

		(isAreaItem ? areaItems : cards).set(id, data as never);
	}

	return { areaItems, cards };
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

export interface NotifyWhenPlayer {
	on: { target: "play-again" | "point" | "boated-from"; value: number };
	subscription: {
		endpoint: string;
		expirationTime: number | null;
		keys: { p256dh: string; auth: string };
	};

	createdAt: Date;
}
