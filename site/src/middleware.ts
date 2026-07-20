import dayjs from "@bandori-stats/bestdori/date";

import { defineMiddleware } from "astro:middleware";
import z from "zod";

const querySchema = z.instanceof(URLSearchParams).transform((searchParams) =>
	[...searchParams.entries()].reduce(
		(acc, [key, value]) => {
			if (value.length === 0) return acc;

			if (!(key in acc)) acc[key] = value;
			else if (Array.isArray(acc[key])) acc[key].push(value);
			else acc[key] = [acc[key], value];

			return acc;
		},
		{} as Record<string, string | string[]>,
	),
);

export const onRequest = defineMiddleware(
	async ({ locals, url, redirect }, next) => {
		const { data, error, success } = querySchema.safeParse(url.searchParams);
		if (import.meta.env.DEV && !success)
			throw new Error(z.prettifyError(error));
		locals.parseQuery = (schema) => schema.parse(success ? data : {});

		if (url.pathname.endsWith("/calendar") && !url.searchParams.has("date")) {
			const search = new URLSearchParams(url.searchParams);
			const thisMonth = dayjs.tz().startOf("month").format("YYYY-MM-DD");
			search.set("date", thisMonth);
			return redirect(`${url.pathname}?${search}`, 302);
		}

		return next();
	},
);
