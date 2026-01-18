import type { Stats } from "@bandori-stats/bestdori/constants";

export type StatValue = Stats[keyof Stats] | undefined;
const getValue = (it: NonNullable<StatValue>) =>
	Array.isArray(it) ? it.length : it;
export const displayValue = (value: StatValue = null) =>
	value !== null ? formatNumber(getValue(value)) : "N/A";
export const compareValue = (
	value: StatValue = null,
	previousValue: StatValue = null,
) =>
	previousValue !== null && value !== null
		? getValue(value) - getValue(previousValue)
		: 0;

const numberFormatter = Intl.NumberFormat("en-US");
const numberFormatterCompact = Intl.NumberFormat("en-US", {
	notation: "compact",
});
export const formatNumber = (n: number, autoCompact = false) =>
	(autoCompact && n >= 100_000
		? numberFormatterCompact
		: numberFormatter
	).format(n);

export const sum = (values: number[]) =>
	values.reduce((acc, next) => acc + next, 0);
export const mean = (values: number[]) => sum(values) / values.length;
