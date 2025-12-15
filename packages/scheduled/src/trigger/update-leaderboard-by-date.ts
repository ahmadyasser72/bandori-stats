import { db } from "@bandori-stats/database";
import { schemaTask } from "@trigger.dev/sdk";
import z from "zod";

import { updateLeaderboard } from "./update-leaderboard";

export const updateLeaderboardByDate = schemaTask({
	id: "update-leaderboard-by-date",
	schema: z.strictObject({ date: z.iso.date() }),
	run: async ({ date }) => {
		const snapshots = await db.query.accounts
			.findMany({
				columns: {},
				with: {
					snapshots: {
						limit: 1,
						columns: { accountId: true, stats: true },
						where: { snapshotDate: { lte: date } },
						orderBy: { snapshotDate: "desc" },
					},
				},
			})
			.then((accounts) => accounts.flatMap(({ snapshots }) => snapshots));

		await updateLeaderboard.trigger({ date, snapshots });
	},
});
