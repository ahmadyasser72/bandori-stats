import { sum } from "@bandori-stats/bestdori/helpers";

export interface PlayerAvatar {
	id: number;
	trained: boolean;
}

export interface PlayerBand {
	name: string;
	totalStats: PlayerBandMemberStat | null;
	members: PlayerBandMember[];
}

export interface PlayerBandMember extends PlayerAvatar {
	attribute: "powerful" | "pure" | "cool" | "happy";
	character: number;
	band: number;

	level: number;
	rarity: number;
	skill: string;
	trainedStatus: boolean;
	limitBreakRank: number;

	stat: PlayerBandMemberStat;
	cardBonus: PlayerBandMemberStat;
	potentialBonus: PlayerBandMemberStat;
	missionBonus: PlayerBandMemberStat;
}

export type PlayerBandMemberStat = Record<StatType, number>;

export const STAT_TYPES = ["performance", "technique", "visual"] as const;
export type StatType = (typeof STAT_TYPES)[number];

export const sumStats = (stat: PlayerBandMemberStat) =>
	sum(Object.values(stat));
