import { idempotencyKeys, schemaTask, tags } from "@trigger.dev/sdk";
import { allKeyed, capitalize, mapValues, pick, sumBy } from "es-toolkit";
import z from "zod";

import { unwrapRegionTuple } from "@bandori-stats/bestdori/helpers";
import { Card } from "@bandori-stats/bestdori/schema/cards";
import { Skills } from "@bandori-stats/bestdori/schema/skills";
import { db, sql } from "@bandori-stats/database";
import { GBP, getAreaItems, redis } from "@bandori-stats/database/redis";
import {
	STAT_TYPES,
	trackerSnapshotProfiles,
	type PlayerBandMember,
	type PlayerBandMemberStateless,
} from "@bandori-stats/database/schema";
import type { UserSituation } from "~/bang-dream-gbp/gen/common_pb";
import type { UserProfile } from "~/bang-dream-gbp/gen/profile_pb";
import { bestdori } from "~/bestdori";
import { bandoriProfile } from "./bandori-profile";

export const updateTrackerProfile = schemaTask({
	id: "update-tracker-profile",
	schema: z.strictObject({
		players: z.array(
			z.object({
				uid: z.string(),
				trackingReference: z.object({
					trackingFor: z.enum(["event", "monthly"]),
					trackingId: z.number(),
				}),
			}),
		),
	}),
	run: async ({ players }) => {
		const version = await redis().get<string>(GBP.version);
		await tags.add(`version_${version ?? "n/a"}`);
		if (!version) return;

		const profiles = new Map<string, UserProfile>();
		for (const { uid } of players) {
			const run = await bandoriProfile.triggerAndWait(
				{ uid },
				{
					idempotencyKey: await idempotencyKeys.create(
						`profile:bandori:${uid}`,
						{ scope: "global" },
					),
					idempotencyKeyTTL: "1h",
				},
			);
			if (!run.ok) {
				console.error(run.error);
				continue;
			}

			profiles.set(uid, run.output!);
		}
		if (profiles.size === 0) return;

		const skills = await bestdori({
			path: "api/skills/all.10.json",
			schema: Skills,
		});

		const values: (typeof trackerSnapshotProfiles.$inferInsert | null)[] =
			await Promise.all(
				players.map(async ({ uid, trackingReference }) => {
					const profile = profiles.get(uid);
					if (!profile) return null;

					const bandMembers = await Promise.all(
						(profile.mainDeckUserSituations?.entries ?? []).map((data) =>
							getBandMember(data, skills),
						),
					);

					return allKeyed({
						...trackingReference,

						uid: profile.userId.toString(),
						name: profile.userName,
						level: profile.rank,
						introduction: profile.introduction,
						avatar: getAvatar(profile),

						band: allKeyed({
							name: profile.mainUserDeck?.deckName!,
							totalStats: calculateTotalBandStats(profile, bandMembers),
							members: bandMembers,
						}),

						titles: Object.values(
							profile.userProfileDegreeMap?.entries ?? {},
						).map(({ degreeId }) => degreeId),
					});
				}),
			);

		await db()
			.insert(trackerSnapshotProfiles)
			.values(values.filter((value) => value !== null))
			.onConflictDoUpdate({
				target: [
					trackerSnapshotProfiles.uid,
					trackerSnapshotProfiles.trackingFor,
					trackerSnapshotProfiles.trackingId,
				],
				set: {
					name: sql.raw(`excluded.${trackerSnapshotProfiles.name.name}`),
					level: sql.raw(`excluded.${trackerSnapshotProfiles.level.name}`),
					introduction: sql.raw(
						`excluded.${trackerSnapshotProfiles.introduction.name}`,
					),
					avatar: sql.raw(`excluded.${trackerSnapshotProfiles.avatar.name}`),
					band: sql.raw(`excluded.${trackerSnapshotProfiles.band.name}`),
					titles: sql.raw(`excluded.${trackerSnapshotProfiles.titles.name}`),
				},
			});
	},
});

const getCardById = async (id: number) =>
	bestdori({ path: `api/cards/${id}.json`, schema: Card });

const getAvatar = async ({ userProfileSituation }: UserProfile) => {
	if (
		!userProfileSituation ||
		!("situationId" in userProfileSituation && "illust" in userProfileSituation)
	)
		return null;

	const card = await getCardById(userProfileSituation.situationId);
	return {
		id: userProfileSituation.situationId,
		trained: userProfileSituation.illust === "after_training",
		attribute: card.attribute,
		character: card.characterId,
		band: CHARACTER_TO_BAND[card.characterId],
		rarity: card.rarity,
	} satisfies PlayerBandMemberStateless;
};

const getBandMember = async (
	data: UserSituation,
	skills: z.infer<typeof Skills>,
) => {
	const card = await getCardById(data.situationId);

	const stat = card.stat[data.level]
		? mapValues(card.stat[data.level]!, (base, type) => {
				if (!data.userAppendParameter) return base;

				return (
					base +
					data.userAppendParameter[type] +
					data.userAppendParameter[`characterPotential${capitalize(type)}`] +
					data.userAppendParameter[`characterBonus${capitalize(type)}`]
				);
			})
		: ZERO_STAT;

	const skill = (() => {
		const skillData = skills.get(card.skillId)!;
		const template = unwrapRegionTuple(skillData.description)!;
		const duration = skillData.duration[data.skillLevel - 1].toString();

		return skillData.onceEffect
			? template
					.replace(
						"{0}",
						skillData.onceEffect.onceEffectValue[
							data.skillLevel - 1
						].toString(),
					)
					.replace("{1}", duration)
			: template.replace("{0}", duration);
	})();

	return {
		id: data.situationId,
		trained: data.illust === "after_training",

		attribute: card.attribute,
		character: card.characterId,
		band: CHARACTER_TO_BAND[card.characterId],

		level: data.level,
		rarity: card.rarity,
		skill,
		trainedStatus: data.trainingStatus === "done",
		limitBreakRank: data.limitBreakRank,

		stat,
		...(data.userAppendParameter
			? {
					cardBonus: pick(data.userAppendParameter, STAT_TYPES),
					potentialBonus: Object.fromEntries(
						STAT_TYPES.map((type) => [
							type,
							data.userAppendParameter![
								`characterPotential${capitalize(type)}`
							],
						]),
					),
					missionBonus: Object.fromEntries(
						STAT_TYPES.map((type) => [
							type,
							data.userAppendParameter![`characterBonus${capitalize(type)}`],
						]),
					),
				}
			: {
					cardBonus: ZERO_STAT,
					potentialBonus: ZERO_STAT,
					missionBonus: ZERO_STAT,
				}),
	} satisfies PlayerBandMember;
};

const calculateTotalBandStats = async (
	{ publishTotalDeckPowerFlg, enabledUserAreaItems }: UserProfile,
	bandMembers: Awaited<ReturnType<typeof getBandMember>>[],
) => {
	if (!publishTotalDeckPowerFlg) return null;

	const areaItems = await getAreaItems(
		(enabledUserAreaItems?.entries ?? []).map(({ areaItemId }) => areaItemId),
	);
	return Object.fromEntries(
		STAT_TYPES.map((type) => [
			type,
			sumBy(bandMembers, ({ attribute, band, stat }) => {
				const multiplier = sumBy(
					areaItems,
					({ targetAttributes, targetBandIds, ...bonus }) =>
						targetAttributes.includes(attribute) && targetBandIds.includes(band)
							? (bonus[type] ?? 0)
							: 0,
				);

				return stat[type] * (1 + multiplier / 100);
			}),
		]),
	);
};

const ZERO_STAT = { performance: 0, technique: 0, visual: 0 };

const CHARACTER_TO_BAND: Record<number, number> = {
	// Poppin'Party
	1: 1,
	2: 1,
	3: 1,
	4: 1,
	5: 1,
	// Afterglow
	6: 2,
	7: 2,
	8: 2,
	9: 2,
	10: 2,
	// Hello, Happy World!
	11: 3,
	12: 3,
	13: 3,
	14: 3,
	15: 3,
	// Pastel*Palettes
	16: 4,
	17: 4,
	18: 4,
	19: 4,
	20: 4,
	// Roselia
	21: 5,
	22: 5,
	23: 5,
	24: 5,
	25: 5,
	// Morfonica
	26: 21,
	27: 21,
	28: 21,
	29: 21,
	30: 21,
	// RAISE A SUILEN
	31: 18,
	32: 18,
	33: 18,
	34: 18,
	35: 18,
	// MyGO!!!!!
	36: 45,
	37: 45,
	38: 45,
	39: 45,
	40: 45,
};
