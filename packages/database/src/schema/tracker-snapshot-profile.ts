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

	level: number;
	trainedStatus: boolean;
	skillLevel: number;
	limitBreakRank: number;

	stat: PlayerBandMemberStat;
	cardBonus: PlayerBandMemberStat;
	potentialBonus: PlayerBandMemberStat;
	missionBonus: PlayerBandMemberStat;
}

export type PlayerBandMemberStat = Record<StatType, number>;
export type StatType = "performance" | "technique" | "visual";
