import dayjs from "@bandori-stats/bestdori/date";

import { defineMiddleware } from "astro:middleware";
import z from "zod";

import { maybeArray } from "./lib/schema";

const querySchema = z.preprocess(
	(input) => {
		if (!(input instanceof URLSearchParams)) return {};

		const normalized = new URLSearchParams(
			[...input.entries()].filter(([, value]) => value),
		);
		normalized.sort();

		return {
			normalized,
			object: [...normalized.entries()].reduce(
				(acc, [key, value]) => {
					if (value.length === 0) return acc;

					if (!(key in acc)) acc[key] = value;
					else if (Array.isArray(acc[key])) acc[key].push(value);
					else acc[key] = [acc[key], value];

					return acc;
				},
				{} as Record<string, string | string[]>,
			),
		};
	},
	z.object({
		object: z.record(z.string(), z.string().nonempty().apply(maybeArray)),
		normalized: z.instanceof(URLSearchParams),
	}),
);

export const onRequest = defineMiddleware(
	async ({ locals, url, redirect }, next) => {
		const { data, error, success } = querySchema.safeParse(url.searchParams);
		if (import.meta.env.DEV && !success)
			throw new Error(z.prettifyError(error));
		locals.parseQuery = (schema) => schema.parse(success ? data.object : {});

		if (success && data.normalized.toString() !== url.search.slice(1))
			return redirect(
				data.normalized.size > 0
					? `${url.pathname}?${data.normalized}`
					: url.pathname,
				302,
			);

		if (url.pathname.endsWith("/calendar") && !url.searchParams.has("date")) {
			const search = new URLSearchParams(url.searchParams);
			const thisMonth = dayjs.tz().startOf("month").format("YYYY-MM-DD");
			search.set("date", thisMonth);
			search.sort();
			return redirect(`${url.pathname}?${search}`, 302);
		}

		return next();
	},
);
