import { defineMiddleware } from "astro:middleware";
import z from "zod";

import dayjs from "~/lib/date";

const querySchema = z.instanceof(URLSearchParams).transform((searchParams) =>
	[...searchParams.entries()].reduce<App.Locals["query"]>(
		(acc, [key, value]) => {
			if (value.length === 0) return acc;

			if (!(key in acc)) acc[key] = value;
			else if (Array.isArray(acc[key])) acc[key].push(value);
			else acc[key] = [acc[key], value];

			return acc;
		},
		{},
	),
);

export const onRequest = defineMiddleware(
	async ({ locals, url, redirect }, next) => {
		const { data, error, success } = querySchema.safeParse(url.searchParams);
		if (import.meta.env.DEV && !success)
			throw new Error(z.prettifyError(error));
		locals.query = success ? data : {};

		if (url.pathname.endsWith("/calendar") && !locals.query.date) {
			const search = new URLSearchParams(url.searchParams);
			const thisMonth = dayjs.tz().startOf("month").format("YYYY-MM-DD");
			search.set("date", thisMonth);
			return redirect(`${url.pathname}?${search}`, 302);
		}

		return next();
	},
);
