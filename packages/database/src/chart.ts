import { STAT_NAMES, type Stats } from "@bandori-stats/bestdori/constants";
import {
	compareValue,
	displayValue,
	formatNumber,
	getValue,
} from "@bandori-stats/bestdori/helpers";

import type { Chart, ChartType } from "chart.js";
import { titleCase } from "text-case";

import { PLAYER_STATS_SORTED_SET_PREFIX, redis } from "./redis";

export type ChartOptions<T extends ChartType, Data> = ConstructorParameters<
	typeof Chart<T, Data>
>[1];
type Snapshot = { stats: Omit<Stats, "uid" | "titles">; snapshotDate: string };

export const GrowthChart = (
	snapshots: Snapshot[],
	range: "day" | "week" | "month",
) => {
	const availableStats = STAT_NAMES.filter((name) =>
		snapshots.every(({ stats }) => stats[name] !== null),
	);

	const datasets = availableStats.map((name) => {
		const values = snapshots.map(({ stats }) => getValue(stats[name]!));

		const baseline = values.find((v) => v !== null)!;
		const data = snapshots.map(({ snapshotDate }, idx) => {
			const value = values[idx];
			const growth =
				value != null && baseline ? Math.log(value / baseline) : NaN;

			return {
				x: snapshotDate,
				y: growth,
				originalValue: value,
			};
		});

		return {
			label: titleCase(name),
			data,
			dataLabels: data.map(({ originalValue }, idx) => {
				const formatted = displayValue(originalValue);
				const previous = idx > 0 ? data[idx - 1]!.originalValue : null;
				if (previous === null) return formatted;

				const delta = compareValue(originalValue, previous);
				if (delta === 0) return formatted;

				const deltaFormatted = formatNumber(delta, {
					autoCompact: true,
					positiveSign: true,
				});

				return `${formatted} (${deltaFormatted})`;
			}),
			spanGaps: true,
		};
	});

	return {
		type: "line",
		data: { datasets },
		options: {
			spanGaps: true,
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				x: {
					type: "timeseries",
					time: {
						unit: range,
						tooltipFormat: "LL",
					},
					ticks: {
						source: "data",
						autoSkip: true,
					},
				},
				y: { type: "linear", min: 0, display: false },
			},
			interaction: {
				intersect: false,
				mode: "index",
			},
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
