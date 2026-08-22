import { AbortTaskRunError, schemaTask, tags } from "@trigger.dev/sdk";
import z from "zod";

import {
	allKeyed,
	capitalize,
	pick,
	sumBy,
	unwrapRegionTuple,
} from "@bandori-stats/bestdori/helpers";
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
import { bangDreamProfile } from "~/bang-dream-gbp/fetch";
import { bestdori } from "~/bestdori";

export const updateTrackerProfile = schemaTask({
	id: "update-tracker-profile",
	queue: { concurrencyLimit: 1 },
	schema: z.strictObject({
		uid: z.string(),
		trackingReference: z.object({
			trackingFor: z.enum(["event", "monthly"]),
			trackingId: z.number(),
		}),
	}),
	run: async ({ uid, trackingReference }) => {
		const version = await redis().get<string>(GBP.version);
		await tags.add([`uid_${uid}`, `version_${version ?? "n/a"}`]);
		if (!version) return;

		const profile = await bangDreamProfile(version, uid);
		const {
			userName,
			rank,
			introduction,
			userProfileSituation,
			mainUserDeck,
			mainDeckUserSituations,
			publishTotalDeckPowerFlg,
			enabledUserAreaItems,
			userProfileDegreeMap,
		} = profile;

		if (!publishTotalDeckPowerFlg) await tags.add("bp_hidden");

		const getCardById = async (id: number) => {
			const { success, data, error } = Card.safeParse(
				await bestdori(`api/cards/${id}.json`, {}),
			);

			if (!success) {
				await tags.add("schema_error");
				throw new AbortTaskRunError(error.message);
			}

			return data;
		};

		const zeroStat = { performance: 0, technique: 0, visual: 0 };
		const { avatar, areaItems, bandMembers, skillsMap } = await allKeyed({
			avatar: await (async () => {
				if (
					!userProfileSituation ||
					!(
						"situationId" in userProfileSituation &&
						"illust" in userProfileSituation
					)
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
			})(),
			areaItems: getAreaItems(
				(enabledUserAreaItems?.entries ?? []).map(
					({ areaItemId }) => areaItemId,
				),
			),
			bandMembers: Promise.all(
				(mainDeckUserSituations?.entries ?? []).map(async (data) => {
					const card = await getCardById(data.situationId);

					const stat = card.stat[data.level] ?? zeroStat;
					if (data.userAppendParameter && stat !== zeroStat) {
						for (const type of STAT_TYPES) {
							stat[type] +=
								data.userAppendParameter[type] +
								data.userAppendParameter[
									`characterPotential${capitalize(type)}`
								] +
								data.userAppendParameter![`characterBonus${capitalize(type)}`];
						}
					}

					return {
						id: data.situationId,
						trained: data.illust === "after_training",

						attribute: card.attribute,
						character: card.characterId,
						band: CHARACTER_TO_BAND[card.characterId],

						level: data.level,
						rarity: card.rarity,
						skill: { id: card.skillId, level: data.skillLevel },
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
											data.userAppendParameter![
												`characterBonus${capitalize(type)}`
											],
										]),
									),
								}
							: {
									cardBonus: zeroStat,
									potentialBonus: zeroStat,
									missionBonus: zeroStat,
								}),
					} satisfies Omit<PlayerBandMember, "skill"> & {
						skill: { id: number; level: number };
					};
				}),
			),
			skillsMap: bestdori("api/skills/all.10.json", {}).then(async (json) => {
				const { success, data, error } = Skills.safeParse(json);

				if (!success) {
					await tags.add("schema_error");
					throw new AbortTaskRunError(error.message);
				}

				return data;
			}),
		});

		const data: typeof trackerSnapshotProfiles.$inferInsert = {
			...trackingReference,

			uid,
			name: userName,
			level: rank,
			introduction,
			avatar,

			band: {
				name: mainUserDeck?.deckName!,
				totalStats: publishTotalDeckPowerFlg
					? Object.fromEntries(
							STAT_TYPES.map((type) => [
								type,
								sumBy(bandMembers, ({ attribute, band, stat }) => {
									const multiplier = sumBy(
										areaItems,
										({ targetAttributes, targetBandIds, ...bonus }) =>
											targetAttributes.includes(attribute) &&
											targetBandIds.includes(band)
												? (bonus[type] ?? 0)
												: 0,
									);

									return stat[type] * (1 + multiplier / 100);
								}),
							]),
						)
					: null,
				members: bandMembers.map(({ skill, ...member }) => ({
					...member,
					skill: (() => {
						const data = skillsMap.get(skill.id)!;
						const template = unwrapRegionTuple(data.description)!;
						const duration = data.duration[skill.level - 1].toString();

						return data.onceEffect
							? template
									.replace(
										"{0}",
										data.onceEffect.onceEffectValue[skill.level - 1].toString(),
									)
									.replace("{1}", duration)
							: template.replace("{0}", duration);
					})(),
				})),
			},

			titles: Object.values(userProfileDegreeMap?.entries ?? {}).map(
				({ degreeId }) => degreeId,
			),
		};

		await db()
			.insert(trackerSnapshotProfiles)
			.values(data)
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
