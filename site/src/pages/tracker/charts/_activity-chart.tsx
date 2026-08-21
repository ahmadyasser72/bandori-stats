import { cell, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/preact";
import { tooltip } from "@tanstack/charts/tooltip";
import { scaleBand, scaleLinear } from "d3-scale";
import { useMemo } from "preact/hooks";

import { uniq } from "@bandori-stats/bestdori/helpers";
import { CHART_THEME } from "./_utilities";

export interface ActivityChartProps {
	data: [number, number][];
	label: string;
}

const HOURS = Array.from({ length: 24 }, (_, idx) => idx);

export const ActivityChart = ({ data, label }: ActivityChartProps) => {
	const heatmapData = useMemo(
		() => data.map(([timestamp, value]) => ({ timestamp, value })),
		[data],
	);
	const days = useMemo(
		() => uniq(heatmapData.map(({ timestamp }) => formatDate(timestamp))),
		[heatmapData],
	);
	const maxValue = useMemo(
		() => Math.max(1, ...heatmapData.map(({ value }) => value)),
		[heatmapData],
	);

	const colors = useMemo(() => {
		const styles = getComputedStyle(document.documentElement);
		return {
			base: styles.getPropertyValue("--color-base-300"),
			primary: styles.getPropertyValue("--color-primary"),
		};
	}, []);

	const definition = useMemo(
		() =>
			defineChart(
				{
					marks: [
						cell(heatmapData, {
							x: ({ timestamp }) => new Date(timestamp).getHours(),
							y: ({ timestamp }) => formatDate(timestamp),
							color: "value",
							key: "timestamp",
							inset: 1,
							radius: 2,
						}),
					],
					x: {
						scale: scaleBand<number>().domain(HOURS).paddingInner(0.08),
						axis: { line: false, ticks: false },
					},
					y: {
						scale: scaleBand<string>().domain(days).paddingInner(0.08),
						axis: { line: false, ticks: { size: 0 } },
					},
					color: {
						scale: scaleLinear<string>()
							.domain([0, maxValue])
							.range([colors.base, colors.primary]),
					},
					theme: CHART_THEME,
				},
				{ tooltip },
			),
		[heatmapData, days, maxValue, colors],
	);

	return (
		<div class="mt-8 w-full">
			<h3 class="text-center text-xl font-medium">{label}</h3>
			<div class="max-h-64 scrollbar-gutter-stable overflow-y-auto p-2">
				<Chart
					ariaLabel={label}
					definition={definition}
					height={days.length * 28}
					renderTooltipBody={({ points }) => (
						<div>
							{points.map(({ datum }) => (
								<div key={datum.timestamp}>
									<b>{formatDateTime(datum.timestamp)}</b>
									<div>{datum.value.toLocaleString()}&times;</div>
								</div>
							))}
						</div>
					)}
				/>
			</div>
		</div>
	);
};

const formatDate = (timestamp: number) =>
	new Date(timestamp).toLocaleString("en-US", {
		month: "long",
		day: "numeric",
	});
const formatDateTime = (timestamp: number) =>
	new Date(timestamp).toLocaleString("en-US", {
		month: "long",
		day: "numeric",
		hour: "2-digit",
		hour12: true,
		minute: "2-digit",
	});
