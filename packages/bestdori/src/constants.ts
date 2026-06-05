export const REGIONS = ["JP", "EN", "CN"] as const;
export type Region = (typeof REGIONS)[number];

export const getRegionIndex = (region: Region) => REGIONS.indexOf(region);

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
	uid: string | null;
};

export const ABBREVIATED_STAT_NAMES = {
	highScoreRating: "HSR",
	bandRating: "BR",
	allPerfectCount: "AP",
	fullComboCount: "FC",
	clearCount: "CLEAR",
	rank: "RANK",
	titles: "TITLES",
} satisfies Record<Exclude<keyof Stats, "uid">, string>;

export const RAW_STAT_NAMES = [
	"hsr",
	"dtr",
	"allPerfectCount",
	"fullComboCount",
	"clearCount",
	"rank",
] as const;

export type RawStatName = (typeof RAW_STAT_NAMES)[number];
