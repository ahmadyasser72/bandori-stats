import { db } from "@bandori-stats/database";
import {
	SELECT_STAT_COLUMNS,
	STAT_COLUMNS,
} from "@bandori-stats/database/constants";
import { zScore } from "@bandori-stats/database/schema";
import { logger, schemaTask } from "@trigger.dev/sdk";
import z from "zod";

export const setZScore = schemaTask({
	id: "set-z-score",
	schema: z.strictObject({ latestSnapshotId: z.number().positive() }),
	run: async ({ latestSnapshotId }) => {
		const current = await db.query.zScore.findFirst({
			columns: {
				latestSnapshotId: true,
				...Object.fromEntries(
					STAT_COLUMNS.flatMap((column) => [
						[`n_${column}` as const, true],
						[`mean_${column}` as const, true],
						[`m2_${column}` as const, true],
					]),
				),
			},
		});

		const accountRows = await db.query.accounts.findMany({
			columns: { id: true, username: true },
			where: (t, { and, gt, lte }) =>
				current
					? and(
							gt(t.latestSnapshotId, current.latestSnapshotId),
							lte(t.latestSnapshotId, latestSnapshotId),
						)
					: lte(t.latestSnapshotId, latestSnapshotId),
			with: {
				latestSnapshot: { columns: { ...SELECT_STAT_COLUMNS, id: true } },
			},
		});

		const data = Object.fromEntries(
			STAT_COLUMNS.flatMap((column) => [
				[`n_${column}` as const, current ? current[`n_${column}`] : 0],
				[`mean_${column}` as const, current ? current[`mean_${column}`] : 0],
				[`m2_${column}` as const, current ? current[`m2_${column}`] : 0],
			]),
		);

		const previousSnapshots = new Map<
			number,
			Required<(typeof accountRows)[number]["latestSnapshot"]>
		>();

		if (current) {
			const previousSnapshotRows = await db.query.accountSnapshots.findMany({
				columns: { ...SELECT_STAT_COLUMNS, accountId: true, id: true },
				where: (t, { and, inArray, lte }) =>
					and(
						lte(t.id, current.latestSnapshotId),
						inArray(
							t.accountId,
							accountRows.map(({ id }) => id),
						),
					),
			});

			for (const { accountId, ...snapshot } of previousSnapshotRows) {
				const existing = previousSnapshots.get(accountId);
				if (!existing || existing.id < snapshot.id)
					previousSnapshots.set(accountId, snapshot);
			}
		}

		for (const { id, latestSnapshot } of accountRows) {
			if (!latestSnapshot) continue;

			const previousSnapshot = previousSnapshots.get(id);
			for (const column of STAT_COLUMNS) {
				const newValue = latestSnapshot[column];
				if (newValue === null) continue;
				const oldValue = previousSnapshot?.[column] ?? null;

				let n = data[`n_${column}`]!;
				let mean = data[`mean_${column}`]!;
				let m2 = data[`m2_${column}`]!;

				if (oldValue !== null) {
					if (n > 1) {
						const delta = oldValue - mean;
						mean -= delta / (n - 1);
						m2 -= delta * (oldValue - mean);
					} else {
						mean = 0;
						m2 = 0;
					}

					n -= 1;
				}

				{
					const delta = newValue - mean;
					n += 1;
					mean += delta / n;
					m2 += delta * (newValue - mean);
				}

				data[`n_${column}`] = n;
				data[`mean_${column}`] = mean;
				data[`m2_${column}`] = m2;
			}
		}

		const to = { ...data, latestSnapshotId };
		logger.log("set z-score", { from: current, to });
		if (current) await db.update(zScore).set(to);
		else await db.insert(zScore).values(to);
	},
});
