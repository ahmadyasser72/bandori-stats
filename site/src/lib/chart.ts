import type {
	Chart,
	ChartDataset,
	ChartType,
	DefaultDataPoint,
} from "chart.js";

type ChartOptions<
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

export const defineLineChart = <T>(datasets: ChartDataset<"line", T[]>[]) =>
	defineChart("line", datasets, {
		spanGaps: true,
		scales: {
			x: {
				type: "timeseries",
				time: { unit: "day", tooltipFormat: "LL" },
			},
			y: { type: "linear" },
		},
	});

export const defineComparisonChart = (
	labels: string[],
	datasets: { label: string; data: number[] }[],
	maxValues: number[],
) => {
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

export const useChart = async (
	canvas: HTMLCanvasElement,
	config: ChartOptions<ChartType>,
) => {
	const {
		BarController,
		BarElement,
		CategoryScale,
		Chart,
		Colors,
		Legend,
		LinearScale,
		LineController,
		LineElement,
		PointElement,
		TimeSeriesScale,
		Tooltip,
	} = await import("chart.js");
	await import("chartjs-adapter-dayjs-4");

	Chart.register(
		BarController,
		BarElement,
		CategoryScale,
		Colors,
		Legend,
		LinearScale,
		LineController,
		LineElement,
		PointElement,
		TimeSeriesScale,
		Tooltip,
	);

	// Hydrate tooltip callbacks for comparison charts
	if (config.data.datasets.some((d: any) => d.originalValues)) {
		config.options = {
			...(config.options || {}),
			plugins: {
				...(config.options?.plugins || {}),
				tooltip: {
					...(config.options?.plugins?.tooltip || {}),
					callbacks: {
						label: (context: any) => {
							const originalValue =
								context.dataset.originalValues?.[context.dataIndex];
							return `${context.dataset.label}: ${originalValue ?? context.formattedValue}`;
						},
					},
				},
			},
		};
	}

	return new Chart(canvas, config);
};
