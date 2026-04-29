import { STAT_NAMES, type StatName } from "@bandori-stats/bestdori/constants";
import {
	compareValue,
	displayValue,
	formatNumber,
	getValue,
	type StatValue,
} from "@bandori-stats/bestdori/helpers";
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
	const availableStats = STAT_NAMES.filter((name) =>
		snapshots.every(({ stats }) => stats[name] !== null),
	);

	const datasets = availableStats.map((name) => {
		const values = snapshots.map(({ stats }) => getValue(stats[name]!));

		const baseline = values.find((v) => v !== null)!;
		const data = snapshots.map(({ snapshotDate }, idx) => {
			const value = values[idx];
			const growth =
				value !== null && baseline ? Math.log(value / baseline) : NaN;

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
				const previous = idx > 0 ? data[idx - 1].originalValue : null;
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
			y: { type: "linear", min: 0, display: false },
		},
		interaction: {
			intersect: false,
			mode: "index",
		},
	});
};

export const defineComparisonChart = async (
	datasets: { label: string; data: StatValue[] }[],
) => {
	const maxValues = await getGlobalMaxes();
	const normalizedDatasets = datasets.map((dataset) => ({
		label: dataset.label,
		data: dataset.data.map((value, idx) => {
			const max = maxValues[idx];
			return max > 0 && typeof value === "number" ? value / max : 0;
		}),
		dataLabels: dataset.data.map(displayValue),
	}));

	return defineChart(
		"bar",
		normalizedDatasets,
		{
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
		STAT_NAMES.map((name) => titleCase(name)),
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
