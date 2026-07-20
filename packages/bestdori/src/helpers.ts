import type { Stats } from "@bandori-stats/bestdori/constants";

import { startCase, words } from "es-toolkit";

export const accountHasNickname = (account: {
	username: string;
	nickname: string | null;
}) => account.nickname?.trim() && account.username !== account.nickname;

export const abbreviateStatName = (name: keyof Stats) => {
	switch (name) {
		case "allPerfectCount":
		case "fullComboCount":
		case "bandRating":
		case "highScoreRating":
			return words(name.replace(/Count$/, ""))
				.map((s) => s.charAt(0))
				.join("")
				.toUpperCase();
		case "clearCount":
			return "CLEAR";
		case "rank":
		case "titles":
			return name.toUpperCase();
	}
};

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
			return startCase(name);
	}
};

export type StatValue = Stats[keyof Stats] | undefined;
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

export * from "es-toolkit";
