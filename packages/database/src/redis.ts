import { Redis } from "@upstash/redis";
import { once } from "es-toolkit";

import type { GbpMetadata } from "./schema";
import type { PlayerBandMemberStat } from "./schema/tracker";

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

type Id = "current" | number;
type IdPrefixed<P extends string> = `${P}:${Id}`;
const idPrefixed = <P extends string>(prefix: P) =>
	new Proxy({} as Record<Id, IdPrefixed<P>>, {
		get: (_target, prop): IdPrefixed<P> => {
			const id = Number(prop);
			if (Number.isInteger(id) && id > 0) return `${prefix}:${id}`;

			return `${prefix}:current`;
		},
	});

export const GBP = {
	version: "gbp:version",
	credentials: "gbp:credentials",
	areaItems: "gbp:area-items",
	event: idPrefixed("gbp:event"),
	monthly: idPrefixed("gbp:monthly"),

	fromMetadata: (
		{ kind, id }: Pick<GbpMetadata, "kind" | "id">,
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

export interface BangDreamAreaItem extends PlayerBandMemberStat {
	targetAttributes: ("powerful" | "pure" | "cool" | "happy")[];
	targetBandIds: number[];
}

const emptyAreaItem = {
	performance: 0,
	technique: 0,
	visual: 0,
	targetAttributes: [],
	targetBandIds: [],
};
export const getAreaItems = async (
	ids: number[],
): Promise<BangDreamAreaItem[]> => {
	if (ids.length === 0) return [];

	const paths = ids.map((id) => `$.${id}`);
	const results = await redis().json.get<Record<string, [BangDreamAreaItem]>>(
		GBP.areaItems,
		...paths,
	);
	if (!results) return ids.map(() => emptyAreaItem);

	return paths.map((path) => results[path].pop() ?? emptyAreaItem);
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
