import type { MiddlewareHandler } from "astro";

import { createDrizzle } from "./db";

export const onRequest: MiddlewareHandler = (context, next) => {
	context.locals.db = createDrizzle(context.locals.runtime.env.PLAYER_DB);

	return next();
};
