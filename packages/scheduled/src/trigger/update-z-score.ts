import { db } from "@bandori-stats/database";
import { zScore } from "@bandori-stats/database/schema";
import { logger, schemaTask } from "@trigger.dev/sdk";
import z from "zod";

import { SELECT_STAT_COLUMNS, STAT_COLUMNS } from "./shared";

export const updateZScore = schemaTask({
	id: "update-z-score",
	schema: z.strictObject({ latestSnapshotId: z.number().nonnegative() }),
	run: async ({ latestSnapshotId }) => {
		const current = await db.query.zScore.findFirst({
			columns: {
				latestSnapshotId: true,
				rowCount: true,
				...Object.fromEntries(
					STAT_COLUMNS.flatMap((column) => [
						[`sum_${column}` as const, true],
						[`sum_${column}2` as const, true],
					]),
				),
			},
		});

		const rows = await db.query.accounts.findMany({
			columns: { username: true },
			where: (t, { and, gt, lte }) =>
				current
					? and(
							gt(t.latestSnapshotId, current.latestSnapshotId),
							lte(t.latestSnapshotId, latestSnapshotId),
						)
					: lte(t.latestSnapshotId, latestSnapshotId),
			with: { latestSnapshot: { columns: SELECT_STAT_COLUMNS } },
		});

		const data = Object.fromEntries(
			STAT_COLUMNS.flatMap((column) => [
				[`sum_${column}` as const, current ? current[`sum_${column}`] : 0],
				[`sum_${column}2` as const, current ? current[`sum_${column}2`] : 0],
			]),
		);

		if (current) {
			const previousSnapshots = await db.query.accounts
				.findMany({
					columns: { username: true },
					where: (t, { and, inArray, lte }) =>
						and(
							lte(t.latestSnapshotId, current.latestSnapshotId),
							inArray(
								t.username,
								rows.map(({ username }) => username),
							),
						),
					with: { latestSnapshot: { columns: SELECT_STAT_COLUMNS } },
				})
				.then(
					(snapshots) =>
						new Map(
							snapshots.map(({ username, latestSnapshot }) => [
								username,
								latestSnapshot,
							]),
						),
				);

			for (const { username, latestSnapshot } of rows) {
				if (!latestSnapshot) continue;

				const previousSnapshot = previousSnapshots.get(username);
				for (const column of STAT_COLUMNS) {
					const value = latestSnapshot[column] ?? 0;
					const prev = previousSnapshot?.[column] ?? 0;
					data[`sum_${column}`]! += value - prev;
					data[`sum_${column}2`]! += value * value - prev * prev;
				}
			}

			const to = {
				...data,
				latestSnapshotId,
				rowCount: current.rowCount + rows.length - previousSnapshots.size,
			};

			logger.log("update z-score", { from: current, to });
			await db.update(zScore).set(to);
		} else {
			let rowCount = 0;
			for (const { latestSnapshot } of rows) {
				if (!latestSnapshot) continue;

				rowCount += 1;
				for (const column of STAT_COLUMNS) {
					const value = latestSnapshot[column] ?? 0;
					data[`sum_${column}`]! += value;
					data[`sum_${column}2`]! += value * value;
				}
			}

			const to = { ...data, latestSnapshotId, rowCount };
			logger.log("set z-score", { to });
			await db.insert(zScore).values(to as never);
		}
	},
});
