export const STAT_COLUMNS = [
	"highScoreRating",
	"bandRating",
	"allPerfectCount",
	"fullComboCount",
	"clearCount",
	"rank",
] as const;

export type StatName = (typeof STAT_COLUMNS)[number];
export type Stat = Record<StatName, number | null>;

export const ABBREVIATED_STAT_COLUMNS: Record<StatName, string> = {
	highScoreRating: "HSR",
	bandRating: "BR",
	allPerfectCount: "AP",
	fullComboCount: "FC",
	clearCount: "CLEAR",
	rank: "RANK",
};
