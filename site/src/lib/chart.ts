import type { ChartType } from "chart.js";

import type { ChartOptions } from "./chart.server";

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
	if (config.data.datasets.some((dataset: any) => dataset.dataLabels)) {
		config.options = {
			...(config.options || {}),
			plugins: {
				...(config.options?.plugins || {}),
				tooltip: {
					...(config.options?.plugins?.tooltip || {}),
					callbacks: {
						label: (context: any) => {
							const dataLabel = context.dataset.dataLabels?.[context.dataIndex];
							return `${context.dataset.label}: ${dataLabel ?? context.formattedValue}`;
						},
					},
				},
			},
		};
	}

	return new Chart(canvas, config);
};
