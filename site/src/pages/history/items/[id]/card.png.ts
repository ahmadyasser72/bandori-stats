import { db } from "@bandori-stats/database";

import type { APIRoute } from "astro";

import { idSchema, ratioSchema } from "~/lib/schema";
import { render } from "./_render-card";

export const GET: APIRoute = async (context) => {
	const id = idSchema.parse(context.params.id);
	const accountId = idSchema.parse(context.url.searchParams.get("account"));
	const snapshots = await db.query.accountSnapshots.findMany({
		limit: 2,
		columns: { snapshotDate: true, stats: true },
		where: { id: { lte: id }, accountId },
		orderBy: { id: "desc" },
		with: {
			account: {
				columns: { username: true, nickname: true },
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
	const ratio = ratioSchema.parse(context.locals.query.ratio);
	return render(context, { ...data, previous, ratio });
};
