import type { Stats } from "@bandori-stats/bestdori/constants";

export const accountHasNickname = (account: {
	username: string;
	nickname: string | null;
}) => account.nickname?.trim() && account.username !== account.nickname;

export type StatValue = Exclude<Stats[keyof Stats], string> | undefined;
const getValue = (it: NonNullable<StatValue>) =>
	Array.isArray(it) ? it.length : it;

export const displayValue = (value: StatValue | string = null) => {
	if (value === null) return "N/A";
	else if (typeof value === "string") return value;
	else return formatNumber(getValue(value));
};

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
export const formatNumber = (n: number, autoCompact = false) => {
	const { format } =
		autoCompact && n >= 100_000 ? numberFormatterCompact : numberFormatter;

	return format(n);
};

export const sum = (values: number[]) =>
	values.reduce((acc, next) => acc + next, 0);
export const mean = (values: number[]) => sum(values) / values.length;
