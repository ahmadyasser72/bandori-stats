import { useEffect } from "preact/hooks";

export interface ChartProps<T> {
	data: T[];
	metadata: { startAt: Date; endAt: Date };
}

export const CHART_THEME = {
	background: "var(--color-base-100)",
	foreground: "var(--color-base-content)",
};

export const formatTimestamp = (timestamp: number | Date) =>
	new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(timestamp);

export const useAutoScroll = (
	scrollRef: preact.RefObject<HTMLDivElement>,
	startAt: Date,
	endAt: Date,
) => {
	useEffect(() => {
		const element = scrollRef.current;
		if (!element) return;
		const now = Math.min(Date.now(), endAt.valueOf());
		const progress =
			(now - startAt.valueOf()) / (endAt.valueOf() - startAt.valueOf());
		element.scrollLeft =
			element.scrollWidth * progress - element.clientWidth * 0.9;
	}, []);
};

export const getChartDimensions = (
	startAt: Date,
	endAt: Date,
	pointWidth: number,
) => {
	const height = (window.innerHeight * 3) / 5; // 60vh
	const durationHours =
		(endAt.valueOf() - startAt.valueOf()) / (60 * 60 * 1000);
	const width = Math.max(height * 2.5, durationHours * pointWidth);
	return { height, width };
};
