import type { Stats } from "@bandori-stats/bestdori/constants";

export const accountHasNickname = (account: {
	username: string;
	nickname: string | null;
}) => account.nickname?.trim() && account.username !== account.nickname;

export const simplifyStatName = (name: keyof Stats) => {
	switch (name) {
		case "highScoreRating":
			return "Score";
		case "bandRating":
			return "Band";
		case "clearCount":
			return "Clear";
		case "fullComboCount":
			return "FC";
		case "allPerfectCount":
			return "AP";
		default:
			return titleCase(name);
	}
};

export type StatValue = Exclude<Stats[keyof Stats], string> | undefined;
export const getValue = (it: NonNullable<StatValue>) =>
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

const numberFormatter = Intl.NumberFormat("en-US", {
	maximumFractionDigits: 2,
});
const numberFormatterCompact = Intl.NumberFormat("en-US", {
	notation: "compact",
	maximumFractionDigits: 2,
});

interface FormatNumberOptions {
	autoCompact?: boolean;
	positiveSign?: boolean;
}
export const formatNumber = (
	n: number,
	{ autoCompact = false, positiveSign = false }: FormatNumberOptions = {},
) => {
	const { format } =
		autoCompact && Math.abs(n) >= 100_000
			? numberFormatterCompact
			: numberFormatter;

	const formatted = format(n);
	return positiveSign && n > 0 ? `+${formatted}` : formatted;
};

export const sum = (values: number[]) =>
	values.reduce((acc, next) => acc + next, 0);

export const titleCase = (s: string) =>
	s
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
