import type { Snapshot } from "@bandori-stats/database/schema";

export const STAT_BADGES = {
	highScoreRating: "badge-primary",
	bandRating: "badge-primary",
	allPerfectCount: "badge-success",
	fullComboCount: "badge-success",
	clearCount: "badge-success",
	rank: "badge-accent",
	titles: "badge-accent",
} satisfies Record<keyof Snapshot["stats"], string>;

export const STAT_STATUSES = {
	highScoreRating: "status-primary",
	bandRating: "status-primary",
	allPerfectCount: "status-success",
	fullComboCount: "status-success",
	clearCount: "status-success",
	rank: "status-accent",
	titles: "status-accent",
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
