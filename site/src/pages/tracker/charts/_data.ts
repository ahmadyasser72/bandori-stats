import dayjs from "@bandori-stats/bestdori/date";
import { pick } from "@bandori-stats/bestdori/helpers";
import { db } from "@bandori-stats/database";
import {
	GAME_EVENT_CURRENT,
	GAME_MONTHLY_CURRENT,
	redis,
} from "@bandori-stats/database/redis";
import type { TrackerSnapshot } from "@bandori-stats/database/schema";

export const fetchTrackerData = async (params: {
	kind: "event" | "monthly";
	id: number;
}) => {
	const key = (
		params.kind === "event" ? GAME_EVENT_CURRENT : GAME_MONTHLY_CURRENT
	).replace("current", params.id.toString());
	const players = (await redis().smembers<number[]>(`${key}:players`)).map(
		(uid) => uid.toString(),
	);

	const fetchSnapshots = (uid: string) =>
		db().query.trackerSnapshots.findMany({
			columns: { id: false, trackingFor: false, trackingId: false },
			where: { trackingFor: params.kind, trackingId: params.id, uid },
			orderBy: { timestamp: "asc" },
		});

	return Promise.all([
		players.length > 0
			? db()
					.batch([
						fetchSnapshots(players[0]),
						...players.slice(1).map(fetchSnapshots),
					])
					.then((entries) => entries.flat())
			: [],
		params.kind === "event"
			? db().query.gbpEvents.findFirst({
					columns: { startAt: true, endAt: true },
					where: { eventId: params.id },
				})
			: db().query.gbpMonthlyRankings.findFirst({
					columns: { startAt: true, endAt: true },
					where: { monthlyRankingId: params.id },
				}),
	]);
};

type Snapshot = Omit<TrackerSnapshot, "id" | "trackingFor" | "trackingId">;

export type ChartEntry<K extends string> = {
	uid: string;
	name: string;
	timestamp: number;
} & { [P in K]: number };

interface ProcessTrackerDataOptions<T extends keyof Snapshot> {
	pick: T[];
	key: T;
	hoursInterval: number;
}

export const processTrackerData = <T extends keyof Snapshot>(
	snapshots: Snapshot[],
	{ pick: pickKeys, key, hoursInterval }: ProcessTrackerDataOptions<T>,
) => {
	const changesByHour = new Map<number, Map<string, Snapshot>>();
	for (const snapshot of snapshots) {
		const hour = dayjs(snapshot.timestamp).startOf("hour").valueOf();

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
		hour = dayjs(hour).add(hoursInterval, "hour").valueOf()
	) {
		const changes = changesByHour.get(hour);
		if (changes) {
			for (const [uid, snapshot] of changes) state.set(uid, snapshot);
		}

		const rankSeen = new Set<number>();
		const snapshots = [...state.values()].sort((a, b) =>
			dayjs(b.timestamp).diff(a.timestamp),
		);
		for (const snapshot of snapshots) {
			if (rankSeen.has(snapshot.rank)) {
				if (!rankSeen.has(Math.min(10, snapshot.rank + 1))) snapshot.rank += 1;
				else if (!rankSeen.has(Math.max(1, snapshot.rank - 1)))
					snapshot.rank -= 1;
				else continue;
			}

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
			rankSeen.add(snapshot.rank);
		}
	}

	// Keep the final occurrence of every UID.
	for (const entry of previous.values()) {
		const last = data.findLast(({ uid }) => uid === entry.uid);
		if (!last || last.timestamp !== entry.timestamp) data.push(entry);
	}

	return data;
};
