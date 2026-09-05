import { TTLCache } from "@isaacs/ttlcache";
import { AbortTaskRunError, logger, tags } from "@trigger.dev/sdk";
import { limitAsync, memoize, retry } from "es-toolkit";
import z from "zod";

interface BestdoriOptions<S extends z.ZodType | false> {
	path: string;
	query?: Record<string, string>;
	cache?: boolean;
	schema: S;
}

type BestdoriFetch = <
	S extends z.ZodType | false,
	O = S extends z.ZodType ? z.infer<S> : Response,
>(
	options: BestdoriOptions<S>,
) => Promise<O>;

const bestdoriFetch: BestdoriFetch = async ({ path, query, schema }) => {
	const url = new URL(path, "https://bestdori.com/");
	url.search = new URLSearchParams(query).toString();

	const response = await logger.trace("fetch-bestdori", (span) => {
		span.setAttribute?.("url", url.href);

		return retry(
			async () => {
				const response = await fetch(url);
				const contentType = response.headers.get("content-type") ?? "";
				if (
					response.ok &&
					(contentType.startsWith("application/json") || !schema)
				)
					return response;

				throw new Error(`Error fetching ${url.href} (${response.status})`);
			},
			{ delay: (attempt) => attempt * 2500, retries: 4 },
		);
	});

	if (!schema) return response as never;

	return logger.trace("parse-bestdori-response", async () => {
		const json = await response.json();
		const { success, data, error } = schema.safeParse(json);
		if (!success) {
			await tags.add("schema_error").catch(() => console.error(error.message));
			throw new AbortTaskRunError(error.message);
		}

		return data as never;
	});
};

const bestdoriCached = memoize(bestdoriFetch, {
	getCacheKey: ({ path, query }) =>
		query ? `${path}?${new URLSearchParams(query)}` : path,
	cache: new TTLCache({
		max: 100,
		ttl: 60 * 60 * 1000,
		checkAgeOnGet: true,
	}) as never,
});

export const bestdori = limitAsync<BestdoriFetch>(
	({ cache = true, ...options }) =>
		(cache ? bestdoriCached : bestdoriFetch)(options),
	4,
);

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
