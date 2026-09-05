import { Redis } from "@upstash/redis";
import { once, uniq } from "es-toolkit";
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

export const getAreaItems = (() => {
	const emptyAreaItem = {
		level: 0,
		areaItemName: "",
		performance: 0,
		technique: 0,
		visual: 0,
		targetAttributes: [],
		targetBandIds: [],
	} satisfies BangDreamAreaItem;

	return async (ids: number[]) => {
		if (ids.length === 0) return {};

		const uniqueIds = uniq(ids);
		const results = await redis().mget<(BangDreamAreaItem | null)[]>(
			uniqueIds.map((id) => GBP.data.AreaItem[id]),
		);

		return Object.fromEntries<BangDreamAreaItem>(
			uniqueIds.map((id, idx) => [id, results[idx] ?? emptyAreaItem]),
		);
	};
})();

export type BangDreamCard = Omit<
	z.infer<typeof GameCharacterSituation>,
	"situationSkillId"
> & { skillId: number };

export const getCards = async (ids: (number | undefined)[]) => {
	const safeIds = ids.filter((it): it is number => !!it);
	if (safeIds.length === 0) return {};

	const uniqueIds = uniq(safeIds);
	const results = await redis().mget<BangDreamCard[]>(
		uniqueIds.map((id) => GBP.data.CharacterSituation[id]),
	);

	return Object.fromEntries<BangDreamCard>(
		uniqueIds.map((id, idx) => [id, results[idx]]),
	);
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
