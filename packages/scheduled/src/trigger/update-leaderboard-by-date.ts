import { db } from "@bandori-stats/database";
import { SELECT_STAT_COLUMNS } from "@bandori-stats/database/constants";
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
						columns: { ...SELECT_STAT_COLUMNS, accountId: true },
						where: (t, { lte }) => lte(t.snapshotDate, date),
						orderBy: (t, { desc }) => desc(t.snapshotDate),
					},
				},
			})
			.then((accounts) => accounts.flatMap(({ snapshots }) => snapshots));

		await updateLeaderboard.trigger({ date, snapshots });
	},
});
