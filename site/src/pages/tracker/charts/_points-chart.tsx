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
	point: number;
	rank: number;
}

export const PointsChart = ({
	data,
	metadata: { startAt, endAt },
}: ChartProps<Datum>) => {
	const chartData = useMemo(() => {
		const previous = new Map<string, number>();

		return data.map((point) => {
			const previousPoint = previous.get(point.uid);
			const delta =
				previousPoint === undefined ? undefined : point.point - previousPoint;

			previous.set(point.uid, point.point);
			return { ...point, delta, rank: point.rank };
		});
	}, [data]);

	const definition = useMemo(
		() =>
			defineChart(
				{
					marks: [
						lineY(chartData, {
							id: "point-lines",
							x: ({ timestamp }) => new Date(timestamp),
							y: "point",
							color: "uid",
							key: ({ uid, timestamp }) => `${uid}:${timestamp}`,
							curve: d3Curve(curveBumpX),
							strokeWidth: 2,
						}),
						dot(chartData, {
							id: "point-dots",
							x: ({ timestamp }) => new Date(timestamp),
							y: "point",
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
						scale: scaleLinear,
						grid: true,
						axis: {
							label: "Points",
						},
					},
					theme: CHART_THEME,
				},
				{ tooltip },
			),
		[chartData, startAt, endAt],
	);

	const scrollRef = useRef<HTMLDivElement>(null);
	useAutoScroll(scrollRef, startAt, endAt);

	const { height, width } = getChartDimensions(startAt, endAt);
	return (
		<div class="container overflow-x-auto" ref={scrollRef}>
			<Chart
				className="mx-auto py-2"
				ariaLabel="Hourly points chart"
				definition={definition}
				height={height}
				renderTooltipBody={({ points }) => (
					<div>
						{points.map(({ datum }) => (
							<div key={`${datum.uid}-${datum.timestamp}`}>
								<b>
									#{datum.rank} {datum.name} - {datum.point.toLocaleString()}{" "}
									Pts
								</b>
								{datum.delta !== undefined && datum.delta > 0 && (
									<div>+{datum.delta.toLocaleString()} Pts</div>
								)}
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
