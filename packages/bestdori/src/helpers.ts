import { startCase, words } from "es-toolkit";
import type z from "zod";

import type { Account } from "@bandori-stats/database/schema";
import type { Stats } from "./constants";
import type { GameEventType } from "./schema/misc";

export const accountHasNickname = (
	account: Pick<Account, "username" | "nickname">,
) => account.nickname?.trim() && account.username !== account.nickname;

export const abbreviateStatName = (name: keyof Stats) => {
	switch (name) {
		case "allPerfectCount":
		case "fullComboCount":
		case "bandRating":
		case "highScoreRating":
			return words(name.replace(/Count$/, ""))
				.map((s) => s.charAt(0))
				.join("")
				.toLowerCase();
		case "clearCount":
			return "clear";
		case "rank":
		case "titles":
			return name;
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

export const stripBB = (s?: string) => s?.replace(/\[[^\]]+\]/g, "") as string;

export const formatEventType = (t: z.infer<typeof GameEventType>) => {
	switch (t) {
		case "story":
			return "Normal";
		case "versus":
			return "VS Live";
		case "mission_live":
			return "Mission Live";
		case "challenge":
			return "Challenge Live";
		case "live_try":
			return "Live Goals";
		case "medley":
			return "Medley Live";
		case "festival":
			return "Team Live Festival";
	}
};

export const unwrapRegionTuple = <T>(
	tuple?: [T, T, T, T, T],
	config: { primary: number; fallback: number | false } = {
		primary: 1,
		fallback: 0,
	},
) => {
	const { primary, fallback } = config;

	const main = tuple?.at(primary) ?? null;
	if (fallback === false) return main;

	return main ?? tuple?.at(fallback) ?? null;
};
