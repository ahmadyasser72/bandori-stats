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

export const SELECT_STAT_COLUMNS: Record<StatName, true> = {
	highScoreRating: true,
	bandRating: true,
	allPerfectCount: true,
	fullComboCount: true,
	clearCount: true,
	rank: true,
};
