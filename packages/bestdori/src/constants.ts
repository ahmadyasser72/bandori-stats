export const STAT_NAMES = [
	"highScoreRating",
	"bandRating",
	"allPerfectCount",
	"fullComboCount",
	"clearCount",
	"rank",
] as const;

export type StatName = (typeof STAT_NAMES)[number];
export type Stats = Record<StatName, number | null> & {
	titles: number[] | null;
};

export const ABBREVIATED_STAT_NAMES: Record<keyof Stats, string> = {
	highScoreRating: "HSR",
	bandRating: "BR",
	allPerfectCount: "AP",
	fullComboCount: "FC",
	clearCount: "CLEAR",
	rank: "RANK",
	titles: "TITLES",
};

export const RAW_STAT_NAMES = [
	"hsr",
	"dtr",
	"allPerfectCount",
	"fullComboCount",
	"clearCount",
	"rank",
] as const;

export type RawStatName = (typeof RAW_STAT_NAMES)[number];
