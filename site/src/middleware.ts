import { defineMiddleware } from "astro:middleware";
import z from "zod";

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
	async ({ cache, locals, url }, next) => {
		const { data, error, success } = querySchema.safeParse(url.searchParams);
		if (import.meta.env.DEV && !success)
			throw new Error(z.prettifyError(error));
		locals.query = success ? data : {};

		if (cache.enabled) cache.set({ maxAge: 3600 });

		return next();
	},
);
