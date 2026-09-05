import { sum } from "es-toolkit";
import z from "zod";

import type { GbpMetadata } from ".";
import { db } from "../db";

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

export const sumStats = (stat: PlayerBandMemberStat) =>
	sum(Object.values(stat));

export const STAT_TYPES = ["performance", "technique", "visual"] as const;
export type StatType = (typeof STAT_TYPES)[number];

export const TRACKER_KIND = ["event", "music", "monthly"] as const;
export type TrackerKind = (typeof TRACKER_KIND)[number];

export const TrackingReference = z.object({
	trackingFor: z.enum(TRACKER_KIND),
	trackingId: z.number(),
});
export const TrackingTarget = z.object({
	kind: z.enum(["event", "monthly"]),
	id: z.coerce.number(),
});

export type TrackingReference = z.infer<typeof TrackingReference>;
export type TrackingTarget = z.infer<typeof TrackingTarget>;

export const getTrackingReference = ({ kind, id }: TrackingTarget) =>
	({
		trackingFor: kind,
		trackingId: id,
	}) satisfies TrackingReference;

export const getTrackingMetadata = async ({ kind, id }: TrackingTarget) => {
	if (kind === "event")
		return db()
			.query.gbpEvents.findFirst({ where: { id }, with: { musics: true } })
			.then((value): GbpMetadata | undefined =>
				value ? { kind: "event", ...value } : undefined,
			);

	if (kind === "monthly")
		return db()
			.query.gbpMonthlyRankings.findFirst({ where: { id } })
			.then((value): GbpMetadata | undefined =>
				value ? { kind: "monthly", ...value } : undefined,
			);
};
