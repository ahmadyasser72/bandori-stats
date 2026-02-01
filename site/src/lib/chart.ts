import type { Chart, ChartDataset } from "chart.js";

type LineChart<T> = ConstructorParameters<typeof Chart<"line", T[]>>[1];

export const defineLineChart = <T>(datasets: ChartDataset<"line", T[]>[]) => {
	const options = {
		type: "line",
		data: { datasets },
		options: {
			scales: {
				x: {
					type: "timeseries",
					time: { unit: "day", tooltipFormat: "LL" },
				},
				y: { type: "linear" },
			},
		},
	} satisfies LineChart<T>;

	return { "data-line-chart": JSON.stringify(options) };
};

export const useLineChart = async <T>(
	canvas: HTMLCanvasElement,
	options: LineChart<T>,
) => {
	const {
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
		Colors,
		Legend,
		LinearScale,
		LineController,
		LineElement,
		PointElement,
		TimeSeriesScale,
		Tooltip,
	);

	return new Chart(canvas, options);
};
