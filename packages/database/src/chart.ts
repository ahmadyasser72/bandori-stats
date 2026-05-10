import { STAT_NAMES, type Stats } from "@bandori-stats/bestdori/constants";
import {
	compareValue,
	displayValue,
	formatNumber,
} from "@bandori-stats/bestdori/helpers";

import type { Chart, ChartType } from "chart.js";
import dayjs from "dayjs";
import { titleCase } from "text-case";

import { PLAYER_STATS_SORTED_SET_PREFIX, redis } from "./redis";

type ChartName = "comparison" | "progress";
export type ChartOptions<T extends ChartType, Data> = ConstructorParameters<
	typeof Chart<T, Data>
>[1] & { __name: ChartName };

type Activity = { value: number; delta: number };
type Snapshot = { stats: Omit<Stats, "uid" | "titles">; snapshotDate: string };

const calculateActivities = (entries: [string, number][]) => {
	const activities = entries.map(([date, current], idx): [string, Activity] => {
		const previous = idx > 0 ? entries[idx - 1]![1] : null;
		return [
			date,
			{ value: current, delta: Math.max(0, compareValue(current, previous)) },
		];
	});

	const activityByDate = new Map(activities);
	const start = dayjs(activities[0]![0]);
	const end = dayjs(activities.at(-1)![0]);

	const filled: typeof activities = [];
	let currentValue = activities[0]![1].value;
	for (
		let date = start;
		date.isBefore(end) || date.isSame(end);
		date = date.add(1, "day")
	) {
		const key = date.format("YYYY-MM-DD");

		const existing = activityByDate.get(key);
		const value = existing ? (currentValue = existing.value) : currentValue;
		filled.push([key, { value, delta: existing?.delta ?? 0 }]);
	}

	return filled;
};

const aggregateActivities = (entries: [string, Activity][], days: number) => {
	const aggregates = new Map<string, Activity>();

	entries.forEach(([date, current], idx) => {
		if (idx === 0) return;

		const previous = entries[idx - 1]![1];
		const delta = Math.max(0, compareValue(current.delta, previous.delta));

		const key = dayjs(date)
			.subtract(dayjs(date).day() % days, "day")
			.format("YYYY-MM-DD");
		const existing = aggregates.get(key);
		aggregates.set(key, {
			value: current.value,
			delta: (existing?.delta ?? 0) + delta,
		});
	});

	return [...aggregates.entries()];
};

export const StatsSparklineChart = (
	entries: [string, number][],
	period: "30d" | "90d" | "all",
) => {
	const activities = calculateActivities(entries);

	let aggregateDays: number;
	if (period === "30d") aggregateDays = 1;
	else if (period === "90d") aggregateDays = 3;
	else aggregateDays = 7;
	const aggregated = aggregateActivities(activities, aggregateDays);

	const data = aggregated.map(([date, { value, delta }]) => ({
		x: date,
		y: Math.log10(delta + 1),
		label:
			delta > 0
				? `${displayValue(value)} (${formatNumber(delta, { autoCompact: true, positiveSign: true })})`
				: displayValue(value),
	}));

	return {
		__name: "progress",
		type: "line",
		data: {
			datasets: [
				{
					data,
					fill: true,
					tension: 0.35,
					pointRadius: 0,
					pointHitRadius: 8,
					borderWidth: 2,
					clip: 8,
				},
			],
		},
		options: {
			normalized: true,
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				x: {
					display: false,
					type: "time",
					time: {
						unit: period === "all" ? "month" : "day",
						tooltipFormat: "LL",
					},
					grid: { display: false },
					border: { display: false },
				},
				y: {
					display: false,
					beginAtZero: true,
					grid: { display: false },
					border: { display: false },
				},
			},
			interaction: { mode: "index", intersect: false },
			plugins: { legend: { display: false } },
		},
	} satisfies ChartOptions<"line", { x: string; y: number }[]>;
};

interface Comparison {
	username: string;
	snapshot: Snapshot;
}

export const ComparisonChart = (
	reference: Comparison,
	compared: Comparison,
	maxStats: number[],
) => {
	const normalizedDatasets = [reference, compared].map(
		({ username, snapshot }) => {
			const stats = Object.values(snapshot.stats);

			return {
				label: `@${username} (${snapshot.snapshotDate})`,
				data: stats.map((value, idx) => {
					const max = maxStats[idx]!;
					return max > 0 && typeof value === "number" ? value / max : 0;
				}),
				dataLabels: stats.map(displayValue),
			};
		},
	);

	return {
		__name: "comparison",
		type: "bar",
		data: {
			labels: STAT_NAMES.map((name) => titleCase(name)),
			datasets: normalizedDatasets,
		},
		options: {
			indexAxis: "y" as const,
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				x: { display: false, max: 1 },
				y: { ticks: { autoSkip: false } },
			},
			plugins: {
				tooltip: { mode: "index" },
			},
		},
	} satisfies ChartOptions<"bar", number[]>;
};

export const getGlobalMaxes = async () => {
	const pipe = redis.pipeline();
	for (const stat of STAT_NAMES) {
		pipe.zrange(`${PLAYER_STATS_SORTED_SET_PREFIX}:${stat}`, 0, 0, {
			withScores: true,
			rev: true,
		});
	}

	const range = await pipe.exec<[number, number][]>();
	return range.map(([, max]) => max);
};
