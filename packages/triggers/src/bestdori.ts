import { TTLCache } from "@isaacs/ttlcache";
import { AbortTaskRunError, logger, queue, tags } from "@trigger.dev/sdk";
import { limitAsync, memoize, retry } from "es-toolkit";
import z from "zod";

interface BestdoriOptions<S extends z.ZodType | false> {
	path: string;
	query?: Record<string, string>;
	schema: S;
}

type BestdoriFetch = <
	S extends z.ZodType | false,
	O = S extends z.ZodType ? z.infer<S> : Response,
>(
	options: BestdoriOptions<S>,
) => Promise<O>;

export const bestdori = limitAsync<BestdoriFetch>(
	memoize(
		async ({ path, query, schema }) => {
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
					await tags.add("schema_error");
					throw new AbortTaskRunError(error.message);
				}

				return data as never;
			});
		},
		{
			getCacheKey: ({ path, query }) =>
				query ? `${path}?${new URLSearchParams(query)}` : path,
			cache: new TTLCache({
				max: 100,
				ttl: 60 * 60 * 1000,
				checkAgeOnGet: true,
			}) as never,
		},
	),
	4,
);

export const bestdoriQueue = queue({
	name: "bestdori-queue",
	concurrencyLimit: 4,
});
