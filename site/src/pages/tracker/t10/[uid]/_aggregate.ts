import { mapValues } from "es-toolkit";

import dayjs from "@bandori-stats/bestdori/date";
import {
	and,
	asc,
	avg,
	db,
	eq,
	gt,
	gte,
	lte,
	max,
	min,
	sql,
} from "@bandori-stats/database";
import { trackerSnapshots } from "@bandori-stats/database/schema";
import type { TrackingTarget } from "@bandori-stats/database/tracker";

export const outlierCap = ({ kind }: TrackingTarget) =>
	kind === "monthly" ? 60 : 100_000;

export const createBaseFilter = ({ kind, id }: TrackingTarget, uid: string) =>
	and(
		eq(trackerSnapshots.trackingFor, kind),
		eq(trackerSnapshots.trackingId, id),
		eq(trackerSnapshots.uid, uid),
	);

export const countSql = sql<number>`COUNT(*)`;
export const deltaSql = sql<number>`${trackerSnapshots.point} - LAG(${trackerSnapshots.point}, 1, ${trackerSnapshots.point}) OVER (ORDER BY ${asc(trackerSnapshots.id)})`;
export const createGapsCte = (
	baseFilter: ReturnType<typeof createBaseFilter>,
) =>
	db()
		.$with("gaps")
		.as(
			db()
				.select({
					point: trackerSnapshots.point,
					delta: deltaSql.as("delta"),
					gapMinutes:
						sql<number>`(${trackerSnapshots.timestamp} - LAG(${trackerSnapshots.timestamp}) OVER (ORDER BY ${asc(trackerSnapshots.id)})) / 60000.0`.as(
							"gap_minutes",
						),
					timestamp: trackerSnapshots.timestamp,
				})
				.from(trackerSnapshots)
				.where(baseFilter),
		);

export const createCteFilter = (
	target: TrackingTarget,
	gapsCte: ReturnType<typeof createGapsCte>,
	from: dayjs.Dayjs,
	to: dayjs.Dayjs,
) =>
	and(
		gte(gapsCte.timestamp, from.toDate()),
		lte(gapsCte.timestamp, to.toDate()),
		gt(gapsCte.delta, 0),
		lte(gapsCte.delta, outlierCap(target)),
	);

export const fetchStatistics = async (
	gapsCte: ReturnType<typeof createGapsCte>,
	cteFilter: ReturnType<typeof createCteFilter>,
) => {
	const statistics = await db()
		.with(gapsCte)
		.select({
			gamesTotal: countSql,
			minPoints: min(gapsCte.delta),
			maxPoints: max(gapsCte.delta),
			meanPoints: avg(gapsCte.delta),
			medianPoints: sql<number>`MEDIAN(${gapsCte.delta})`,
			averageMinutesPerGame: avg(
				sql`CASE WHEN ${gapsCte.gapMinutes} <= 10 THEN ${gapsCte.gapMinutes} ELSE NULL END`,
			),

			oldestPoint: min(gapsCte.point),
			latestPoint: max(gapsCte.point),
			latestTimestamp: max(gapsCte.timestamp),
			oldestTimestamp: min(gapsCte.timestamp),
		})
		.from(gapsCte)
		.where(cteFilter)
		.then(([results]) => mapValues(results, (value) => Number(value ?? 0)));

	return {
		...statistics,
		pointsPerHour:
			(statistics.latestPoint - statistics.oldestPoint) /
			dayjs(statistics.latestTimestamp).diff(
				statistics.oldestTimestamp,
				"hours",
				true,
			),
	};
};
