import dayjs from "@bandori-stats/bestdori/date";
import { pick } from "@bandori-stats/bestdori/helpers";
import { and, asc, db, eq, inArray, max, sql } from "@bandori-stats/database";
import { GBP, redis } from "@bandori-stats/database/redis";
import { trackerSnapshots } from "@bandori-stats/database/schema";

export const fetchTrackerData = async (params: {
	kind: "event" | "monthly";
	id: number;
}) => {
	const key = GBP[params.kind][params.id];
	const players = (await redis().smembers<number[]>(`${key}:players`)).map(
		(uid) => uid.toString(),
	);

	const hourBucket =
		sql<number>`CAST(${trackerSnapshots.timestamp} / 3600000 AS INTEGER) * 3600000`.as(
			"hour",
		);

	const snapshots =
		players.length > 0
			? await (() => {
					const latestPerHour = db()
						.$with("latest_per_hour")
						.as(
							db()
								.select({
									uid: trackerSnapshots.uid,
									hour: hourBucket,
									maxId: max(trackerSnapshots.id).as("max_id"),
								})
								.from(trackerSnapshots)
								.where(
									and(
										eq(trackerSnapshots.trackingFor, params.kind),
										eq(trackerSnapshots.trackingId, params.id),
										inArray(trackerSnapshots.uid, players),
									),
								)
								.groupBy(trackerSnapshots.uid, hourBucket),
						);

					return db()
						.with(latestPerHour)
						.select({
							uid: trackerSnapshots.uid,
							name: trackerSnapshots.name,
							rank: trackerSnapshots.rank,
							point: trackerSnapshots.point,
							timestamp: latestPerHour.hour,
						})
						.from(trackerSnapshots)
						.innerJoin(
							latestPerHour,
							eq(trackerSnapshots.id, latestPerHour.maxId),
						)
						.orderBy(asc(latestPerHour.hour));
				})()
			: [];

	const metadata =
		params.kind === "event"
			? db().query.gbpEvents.findFirst({
					columns: { startAt: true, endAt: true },
					where: { eventId: params.id },
				})
			: db().query.gbpMonthlyRankings.findFirst({
					columns: { startAt: true, endAt: true },
					where: { monthlyRankingId: params.id },
				});

	return Promise.all([snapshots, metadata]);
};

type Snapshot = {
	uid: string;
	name: string;
	rank: number;
	point: number;
	timestamp: number;
};

export type ChartEntry<K extends string> = {
	uid: string;
	name: string;
	timestamp: number;
} & { [P in K]: number };

interface ProcessTrackerDataOptions<T extends keyof Snapshot> {
	pick: T[];
	key: T;
}

export const processTrackerData = <T extends keyof Snapshot>(
	snapshots: Snapshot[],
	{ pick: pickKeys, key }: ProcessTrackerDataOptions<T>,
) => {
	const changesByHour = new Map<number, Map<string, Snapshot>>();
	for (const snapshot of snapshots) {
		const hour = snapshot.timestamp;

		let changes = changesByHour.get(hour);
		if (!changes) {
			changes = new Map();
			changesByHour.set(hour, changes);
		}

		changes.set(snapshot.uid, snapshot);
	}

	const firstHour = Math.min(...changesByHour.keys());
	const lastHour = Math.max(...changesByHour.keys());
	const state = new Map<string, Snapshot>();

	const data: ChartEntry<T>[] = [];
	const previous = new Map<string, ChartEntry<T>>();
	for (
		let hour = firstHour;
		hour <= lastHour;
		hour = dayjs(hour).add(1, "hour").valueOf()
	) {
		const changes = changesByHour.get(hour);
		if (changes) {
			for (const [uid, snapshot] of changes) state.set(uid, snapshot);
		}

		const hourSnapshots = [...state.values()].sort(
			(a, b) => b.timestamp - a.timestamp,
		);
		for (const snapshot of hourSnapshots) {
			const entry = {
				timestamp: hour,
				...pick(snapshot, ["uid", "name", ...pickKeys]),
			} as ChartEntry<T>;

			const prev = previous.get(snapshot.uid);
			if (!prev) {
				data.push(entry);
			} else if (prev[key] !== entry[key]) {
				data.push(prev);
				data.push(entry);
			}

			previous.set(snapshot.uid, entry);
		}
	}

	return data;
};
