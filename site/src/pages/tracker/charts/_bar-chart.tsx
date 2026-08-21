import { barX, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/preact";
import { tooltip } from "@tanstack/charts/tooltip";
import { scaleBand, scaleLinear } from "d3-scale";
import { useMemo } from "preact/hooks";

import { CHART_THEME } from "./_utilities";

export interface BarChartProps {
	data: [string, number][];
	label: string;
	color: string;
}

export const BarChart = ({ data, label, color }: BarChartProps) => {
	const chartData = useMemo(
		() => data.map(([key, count]) => ({ key, count })),
		[data],
	);
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
					x: {
						scale: () => scaleLinear().domain([0, maxCount]),
						axis: false,
					},
					y: {
						scale: () => scaleBand().paddingInner(0.2).paddingOuter(0.1),
						axis: { line: false, ticks: { size: 0 } },
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
