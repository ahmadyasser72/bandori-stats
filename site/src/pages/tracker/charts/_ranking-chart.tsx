import { d3Curve, defineChart, dot, lineY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/preact";
import { tooltip } from "@tanstack/charts/tooltip";
import { scaleLinear, scaleUtc } from "d3-scale";
import { curveBumpX } from "d3-shape";
import { useMemo, useRef } from "preact/hooks";

import {
	CHART_THEME,
	formatTimestamp,
	getChartDimensions,
	useAutoScroll,
	type ChartProps,
} from "./_utilities";

interface Datum {
	uid: string;
	name: string;
	timestamp: number;
	rank: number;
}

export const RankingChart = ({
	data,
	metadata: { startAt, endAt },
}: ChartProps<Datum>) => {
	const definition = useMemo(
		() =>
			defineChart(
				{
					marks: [
						lineY(data, {
							id: "rank-lines",
							x: ({ timestamp }) => new Date(timestamp),
							y: "rank",
							color: "uid",
							key: ({ uid, timestamp }) => `${uid}:${timestamp}`,
							curve: d3Curve(curveBumpX),
							strokeWidth: 2,
						}),
						dot(data, {
							id: "rank-dots",
							x: ({ timestamp }) => new Date(timestamp),
							y: "rank",
							color: "uid",
							key: ({ uid, timestamp }) => `${uid}:${timestamp}`,
							r: 3,
						}),
					],
					x: {
						scale: scaleUtc().domain([startAt, endAt]),
						axis: {
							ticks: {
								count: Math.max(
									2,
									Math.ceil(
										(endAt.valueOf() - startAt.valueOf()) /
											(60 * 60 * 1000 * 6),
									),
								),
								format: (date) => formatTimestamp(date),
							},
							label: "Timestamp",
						},
					},
					y: {
						scale: scaleLinear().domain([10 + 0.5, 0.5]),
						grid: true,
						axis: {
							ticks: {
								count: 10,
								format: (rank: number) => `#${rank}`,
							},
							label: "Rank",
						},
					},
					theme: CHART_THEME,
				},
				{ tooltip },
			),
		[data, startAt, endAt],
	);

	const scrollRef = useRef<HTMLDivElement>(null);
	useAutoScroll(scrollRef, startAt, endAt);

	const { height, width } = getChartDimensions(startAt, endAt);
	return (
		<div class="container overflow-x-auto" ref={scrollRef}>
			<Chart
				className="mx-auto py-2"
				ariaLabel="Hourly rank chart"
				definition={definition}
				height={height}
				renderTooltipBody={({ points }) => (
					<div>
						{points.map(({ datum }) => (
							<div key={`${datum.uid}-${datum.timestamp}`}>
								<b>
									#{datum.rank} {datum.name}
								</b>
								<div>{formatTimestamp(datum.timestamp)}</div>
							</div>
						))}
					</div>
				)}
				width={width}
			/>
		</div>
	);
};
