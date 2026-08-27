import { cell, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/preact";
import { tooltip } from "@tanstack/charts/tooltip";
import { scaleBand, scaleLinear } from "d3-scale";
import { uniq } from "es-toolkit";
import { useMemo, useState } from "preact/hooks";

import { CHART_THEME } from "../charts/_utilities";

export interface ActivityChartProps {
	data: [number, [number, number]][];
}

const HOURS = Array.from({ length: 24 }, (_, idx) => idx);

export const ActivityChart = ({ data }: ActivityChartProps) => {
	const heatmapData = useMemo(
		() =>
			data.map(([timestamp, [count, point]]) => ({
				timestamp,
				count,
				point,
			})),
		[data],
	);
	const days = useMemo(
		() => uniq(heatmapData.map(({ timestamp }) => formatDate(timestamp))),
		[heatmapData],
	);

	const [activityKind, setActivityKind] = useState<"count" | "point">("count");
	const title = useMemo(
		() => `Activity heatmap (${activityKind})`,
		[activityKind],
	);
	const maxActivityValue = useMemo(
		() => Math.max(1, ...heatmapData.map((data) => data[activityKind])),
		[heatmapData, activityKind],
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
							color: activityKind,
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
							.domain([0, maxActivityValue])
							.range([colors.base, colors.primary]),
					},
					theme: CHART_THEME,
				},
				{ tooltip },
			),
		[heatmapData, days, activityKind, maxActivityValue, colors],
	);

	return (
		<div class="mt-8 w-full">
			<div class="flex items-center justify-center gap-2">
				<h3 class="text-center text-xl font-medium">{title}</h3>

				<button
					class="btn capitalize btn-xs"
					onClick={() =>
						setActivityKind(activityKind === "count" ? "point" : "count")
					}
				>
					<span class="iconify size-3 lucide--arrow-left-right"></span>
					{activityKind === "count" ? "point" : "count"}
				</button>
			</div>
			<div class="max-h-64 scrollbar-gutter-stable overflow-y-auto p-2">
				<Chart
					ariaLabel={title}
					definition={definition}
					height={days.length * 28}
					renderTooltipBody={({ points }) => (
						<div>
							{points.map(({ datum }) => (
								<div key={datum.timestamp}>
									<b>{formatDateTime(datum.timestamp)}</b>
									<div>
										{datum.count.toLocaleString()}&times;
										{datum.point > 0 && (
											<span> (+{datum.point.toLocaleString()} Pts)</span>
										)}
									</div>
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
