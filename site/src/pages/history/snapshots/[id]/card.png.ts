import { db } from "@bandori-stats/database";

import type { APIRoute } from "astro";
import z from "zod";

import { IdSchema, RatioSchema } from "~/lib/schema";
import { render } from "./_render-card";

export const GET: APIRoute = async (context) => {
	const id = IdSchema.parse(context.params.id);
	const { account, ratio } = context.locals.parseQuery(
		z.object({ account: IdSchema, ratio: RatioSchema }),
	);

	const snapshots = await db().query.accountSnapshots.findMany({
		limit: 2,
		columns: { snapshotDate: true, stats: true },
		where: { id: { lte: id }, accountId: account },
		orderBy: { id: "desc" },
		with: {
			account: {
				columns: { id: true, username: true, nickname: true, profileArt: true },
			},
		},
	});

	if (snapshots.length === 0) return new Response("not found", { status: 404 });

	if (context.cache.enabled) {
		context.cache.set({
			etag: `"${__GIT_HASH__}"`,
			maxAge: 60 * 60 * 24 * 365,
		});
	}

	const [data, previous] = snapshots;
	return render(context, { ...data, previous, ratio });
};
