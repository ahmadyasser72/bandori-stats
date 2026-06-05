import { defineMiddleware } from "astro:middleware";
import z from "zod";

import { maybeArray } from "./lib/schema";

const querySchema = z.instanceof(URLSearchParams).pipe(
	z.preprocess(
		(searchParams) =>
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
		z.record(z.string().nonempty(), z.string().nonempty().apply(maybeArray)),
	),
);

export const onRequest = defineMiddleware(async ({ locals, url }, next) => {
	const { data, error, success } = querySchema.safeParse(url.searchParams);
	if (import.meta.env.DEV && !success) throw new Error(z.prettifyError(error));
	locals.query = success ? data : {};

	return next();
});
