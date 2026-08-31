import { sum } from "es-toolkit";

import type { GbpMetadata } from ".";
import { db } from "../db";

export interface EventMetadata {
	attributes: {
		attribute: "powerful" | "pure" | "cool" | "happy";
		percent: number;
	}[];
	characters: { characterId: number; percent: number }[];
	eventAttributeAndCharacterBonus: {
		pointPercent: number;
		parameterPercent: number;
	};
	eventCharacterParameterBonus?: {
		performance: number;
		technique: number;
		visual: number;
	};
	members: {
		situationId: number;
		percent: number;
	}[];
	limitBreaks: {
		rarity: number;
		rank: number;
		percent: number;
	}[];
}

export interface PlayerAvatar {
	id: number;
	trained: boolean;
}

export interface PlayerBand {
	name: string;
	totalStats: PlayerBandMemberStat | null;
	members: PlayerBandMember[];
}

export interface PlayerBandMemberStateless extends PlayerAvatar {
	attribute: "powerful" | "pure" | "cool" | "happy";
	character: number;
	band: number;
	rarity: number;
}

export interface PlayerBandMember extends PlayerBandMemberStateless {
	level: number;
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

export const getTrackingReference = ({
	kind,
	id,
}: Pick<GbpMetadata, "kind" | "id">) => ({ trackingFor: kind, trackingId: id });

export const getTrackingMetadata = async ({
	kind,
	id,
}: Pick<GbpMetadata, "kind" | "id">) => {
	const metadata = await (kind === "event"
		? db().query.gbpEvents.findFirst({ where: { id } })
		: db().query.gbpMonthlyRankings.findFirst({ where: { id } }));

	if (!metadata) return;
	return { kind, ...metadata } as GbpMetadata;
};
