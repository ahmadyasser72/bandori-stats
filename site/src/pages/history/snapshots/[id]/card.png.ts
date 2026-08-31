import type { APIRoute } from "astro";

import z from "zod";

import { db } from "@bandori-stats/database";
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

	if (snapshots.length === 0) return new Response(null, { status: 404 });

	const [data, previous] = snapshots;
	return context.locals.tracing.enterSpan("render", (span) => {
		const payload = { ...data, previous, ratio };
		span.setAttribute("payload", JSON.stringify(payload));

		return render(context, payload);
	});
};
