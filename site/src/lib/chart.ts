import type { ChartOptions } from "@bandori-stats/database/chart";

import type { ChartType } from "chart.js";

export const defineChart = <T extends ChartType>(
	config: ChartOptions<T, any>,
) => ({ "data-chart": JSON.stringify(config) });

export const useChart = async (
	canvas: HTMLCanvasElement,
	config: ChartOptions<ChartType, any>,
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

	if (config.__name === "comparison") {
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

	if (config.__name === "progress") {
		config.options = {
			...(config.options || {}),
			plugins: {
				...(config.options?.plugins || {}),
				tooltip: {
					...(config.options?.plugins?.tooltip || {}),
					callbacks: {
						label: (context: any) =>
							(
								context.dataset.data[context.dataIndex] as unknown as {
									label: string;
								}
							).label,
					},
				},
			},
		};
	}

	return new Chart(canvas, config);
};
