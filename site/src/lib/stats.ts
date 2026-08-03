import { compareValue, formatNumber } from "@bandori-stats/bestdori/helpers";
import type { Snapshot } from "@bandori-stats/database/schema";
import type { IconName } from "~/components/icon.astro";

export const computeStatDeltas = (
	currentStats: Snapshot["stats"],
	previousStats?: Snapshot["stats"],
) =>
	Object.entries(currentStats)
		.map(([name, value]): [typeof name, number] => [
			name,
			compareValue(value, previousStats?.[name]),
		])
		.filter(([, delta]) => delta > 0)
		.map(([name, delta]): [typeof name, string] => [
			name,
			formatNumber(delta, { autoCompact: true, positiveSign: true }),
		]);

export const STAT_BADGES = {
	highScoreRating: "badge-primary",
	bandRating: "badge-primary",
	allPerfectCount: "badge-success",
	fullComboCount: "badge-success",
	clearCount: "badge-success",
	rank: "badge-accent",
	titles: "badge-accent",
} satisfies Record<keyof Snapshot["stats"], string>;

export const STAT_ICONS = {
	highScoreRating: "lucide--crown",
	bandRating: "lucide--guitar",
	allPerfectCount: "lucide--sparkles",
	fullComboCount: "lucide--zap",
	clearCount: "lucide--circle-check-big",
	rank: "lucide--award",
	titles: "lucide--podium",
} satisfies Record<keyof Snapshot["stats"], IconName>;

export const STAT_STATUSES = {
	highScoreRating: "status-primary",
	bandRating: "status-primary",
	allPerfectCount: "status-success",
	fullComboCount: "status-success",
	clearCount: "status-success",
	rank: "status-accent",
	titles: "status-accent",
} satisfies Record<keyof Snapshot["stats"], string>;

export const STAT_TEXT_COLORS = {
	highScoreRating: "text-primary",
	bandRating: "text-primary",
	allPerfectCount: "text-success",
	fullComboCount: "text-success",
	clearCount: "text-success",
	rank: "text-accent",
	titles: "text-accent",
} satisfies Record<keyof Snapshot["stats"], string>;

export const STAT_TOOLTIPS = {
	highScoreRating: "tooltip-primary",
	bandRating: "tooltip-primary",
	allPerfectCount: "tooltip-success",
	fullComboCount: "tooltip-success",
	clearCount: "tooltip-success",
	rank: "tooltip-accent",
	titles: "tooltip-accent",
} satisfies Record<keyof Snapshot["stats"], string>;
