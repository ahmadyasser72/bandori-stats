export const STAT_NAMES = [
	"highScoreRating",
	"bandRating",
	"allPerfectCount",
	"fullComboCount",
	"clearCount",
	"rank",
] as const;
export type StatName = (typeof STAT_NAMES)[number];

export const RAW_STAT_NAMES = [
	"hsr",
	"dtr",
	"allPerfectCount",
	"fullComboCount",
	"clearCount",
	"rank",
] as const;
export type RawStatName = (typeof RAW_STAT_NAMES)[number];

export type Stats = Record<StatName, number | null> & {
	titles: number[] | null;
};

// BanG Dream GBP Global timezone (US Pacific / UTC-8)
export const GBP_TIMEZONE = "America/Los_Angeles";
