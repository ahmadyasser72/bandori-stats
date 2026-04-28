import { STAT_NAMES, type StatName } from "@bandori-stats/bestdori/constants";
import { getValue } from "@bandori-stats/bestdori/helpers";
import {
	PLAYER_STATS_SORTED_SET_PREFIX,
	redis,
} from "@bandori-stats/database/redis";

import type {
	Chart,
	ChartDataset,
	ChartType,
	DefaultDataPoint,
} from "chart.js";
import { titleCase } from "text-case";

export type ChartOptions<
	T extends ChartType,
	TData = DefaultDataPoint<T>,
> = ConstructorParameters<typeof Chart<T, TData>>[1];

export const defineChart = <T extends ChartType, TData = DefaultDataPoint<T>>(
	type: T,
	datasets: ChartDataset<T, TData>[],
	options: ChartOptions<T, TData>["options"],
	labels?: string[],
) => {
	const config = {
		type,
		data: { labels, datasets },
		options,
	} satisfies ChartOptions<T, TData>;

	return { "data-chart": JSON.stringify(config) };
};

export const defineGrowthChart = async (
	snapshots: { stats: Record<StatName, number | null>; snapshotDate: string }[],
	range: "day" | "week" | "month",
) => {
	const maxValues = await getGlobalMaxes();
	const availableStats = STAT_NAMES.filter((name) =>
		snapshots.every(({ stats }) => stats[name] !== null),
	);

	const datasets = availableStats.map((name, idx) => {
		const maxValue = maxValues[idx];
		const data = snapshots.map(({ stats, snapshotDate }) => {
			const current = stats[name];
			const value =
				current !== null && current !== undefined ? getValue(current) : null;

			return {
				x: snapshotDate,
				y: value !== null ? value / maxValue : NaN,
				originalValue: value,
			};
		});

		return {
			label: titleCase(name),
			data,
			originalValues: data.map(({ originalValue }) => originalValue),
			spanGaps: true,
		};
	});

	return defineChart("line", datasets, {
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
			y: { type: "linear", min: 0, max: 1, display: false },
		},
		plugins: {
			tooltip: { mode: "index" },
		},
	});
};

export const defineComparisonChart = async (
	labels: string[],
	datasets: { label: string; data: number[] }[],
) => {
	const maxValues = await getGlobalMaxes();
	const normalizedDatasets = datasets.map((dataset) => ({
		label: dataset.label,
		data: dataset.data.map((value, idx) => {
			const max = maxValues[idx];
			return max === 0 ? 0 : value / max;
		}),
		originalValues: dataset.data,
	}));

	return defineChart(
		"bar",
		normalizedDatasets,
		{
			indexAxis: "y" as const,
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { display: true },
				tooltip: { enabled: true },
			},
			scales: {
				x: { display: false, max: 1 },
				y: { ticks: { autoSkip: false } },
			},
		},
		labels,
	);
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
