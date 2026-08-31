import { barX, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/preact";
import { tooltip } from "@tanstack/charts/tooltip";
import { scaleBand, scaleLinear } from "d3-scale";
import { sumBy } from "es-toolkit";
import { useMemo } from "preact/hooks";

import { CHART_THEME } from "../charts/_utilities";

export interface BarChartProps {
	data: [number, number][];
	label: string;
	color: string;
	hourly?: boolean;
}

export const BarChart = ({ data, label, color, hourly }: BarChartProps) => {
	const chartData = useMemo(() => {
		if (!hourly)
			return data.map(([key, count]) => ({ key: key.toLocaleString(), count }));

		return Array.from({ length: 24 }, (_, hour) => ({
			key: new Date(2000, 0, 1, hour).toLocaleTimeString("en-US", {
				hour: "2-digit",
				minute: "2-digit",
				hour12: true,
			}),
			count: sumBy(data, ([timestamp, value]) =>
				new Date(timestamp).getHours() === hour ? value : 0,
			),
		}));
	}, [data, hourly]);
	const maxCount = useMemo(
		() => Math.max(...data.map(([, count]) => count)),
		[data],
	);

	const definition = useMemo(
		() =>
			defineChart(
				{
					marks: [
						barX(chartData, {
							id: "bars",
							x: "count",
							y: "key",
							fill: color,
							radius: 4,
						}),
					],
					scales: {
						x: {
							scale: () => scaleLinear().domain([0, maxCount]),
							axis: false,
						},
						y: {
							scale: () => scaleBand().paddingInner(0.2).paddingOuter(0.1),
							axis: { line: false, ticks: { size: 0 } },
						},
					},
					theme: CHART_THEME,
				},
				{ tooltip },
			),
		[chartData, maxCount, color],
	);

	return (
		<div class="mt-8 w-full">
			<h3 class="text-center text-xl font-medium">{label}</h3>
			<div class="max-h-64 scrollbar-gutter-stable overflow-y-auto p-2">
				<Chart
					ariaLabel={label}
					definition={definition}
					height={chartData.length * 32}
					renderTooltipBody={({ points }) => (
						<div>
							{points.map(({ datum }) => (
								<div key={datum.key}>
									<b>
										{datum.key}: {datum.count}&times;
									</b>
								</div>
							))}
						</div>
					)}
				/>
			</div>
		</div>
	);
};
