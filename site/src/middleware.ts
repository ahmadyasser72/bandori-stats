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

export const onRequest = defineMiddleware(async ({ locals, url }, next) => {
	const { data, error, success } = querySchema.safeParse(url.searchParams);
	if (import.meta.env.DEV && !success) throw new Error(z.prettifyError(error));
	locals.query = success ? data : {};

	const response = await next();
	if (import.meta.env.PROD) response.headers.set("cache-control", "max-age=60");

	return response;
});
