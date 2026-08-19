import { AbortTaskRunError, schemaTask, tags } from "@trigger.dev/sdk";
import z from "zod";

import { capitalize, pick, sumBy } from "@bandori-stats/bestdori/helpers";
import { Card } from "@bandori-stats/bestdori/schema/cards";
import { db, sql } from "@bandori-stats/database";
import { GBP, getAreaItems, redis } from "@bandori-stats/database/redis";
import {
	trackerSnapshotProfiles,
	type PlayerBandMember,
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

		const zeroStat = { performance: 0, technique: 0, visual: 0 };
		const statTypes = ["performance", "technique", "visual"] as const;
		const bandMembers = mainDeckUserSituations
			? await Promise.all(
					mainDeckUserSituations.entries.map(async (data) => {
						const {
							success,
							data: card,
							error,
						} = Card.safeParse(
							await bestdori(`api/cards/${data.situationId}.json`, {}),
						);

						if (!success) {
							await tags.add("schema_error");
							throw new AbortTaskRunError(error.message);
						}

						const stat = card.stat[data.level] ?? zeroStat;
						if (data.userAppendParameter && stat !== zeroStat) {
							for (const type of statTypes) {
								stat[type] +=
									data.userAppendParameter[type] +
									data.userAppendParameter[
										`characterPotential${capitalize(type)}`
									] +
									data.userAppendParameter![
										`characterBonus${capitalize(type)}`
									];
							}
						}

						return {
							id: data.situationId,
							trained: data.illust === "after_training",

							attribute: card.attribute,
							character: card.characterId,

							level: data.level,
							trainedStatus: data.trainingStatus === "done",
							skillLevel: data.skillLevel,
							limitBreakRank: data.limitBreakRank,

							stat,
							...(data.userAppendParameter
								? {
										cardBonus: pick(data.userAppendParameter, statTypes),
										potentialBonus: Object.fromEntries(
											statTypes.map((type) => [
												type,
												data.userAppendParameter![
													`characterPotential${capitalize(type)}`
												],
											]),
										),
										missionBonus: Object.fromEntries(
											statTypes.map((type) => [
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
						} satisfies PlayerBandMember;
					}),
				)
			: [];

		const areaItems = await getAreaItems(
			enabledUserAreaItems?.entries.map(({ areaItemId }) => areaItemId) ?? [],
		);

		const data: typeof trackerSnapshotProfiles.$inferInsert = {
			...trackingReference,

			uid,
			name: userName,
			level: rank,
			introduction,

			avatar:
				userProfileSituation &&
				"situationId" in userProfileSituation &&
				"illust" in userProfileSituation
					? {
							id: userProfileSituation.situationId,
							trained: userProfileSituation.illust === "after_training",
						}
					: null,

			band: {
				name: mainUserDeck?.deckName!,
				totalStats: publishTotalDeckPowerFlg
					? Object.fromEntries(
							statTypes.map((type) => [
								type,
								sumBy(bandMembers, ({ attribute, character, stat }) => {
									const multiplier = sumBy(
										areaItems,
										({ targetAttributes, targetBandIds, ...bonus }) =>
											targetAttributes.includes(attribute) &&
											targetBandIds.includes(CHARACTER_TO_BAND[character])
												? (bonus[type] ?? 0)
												: 0,
									);

									return stat[type] * (1 + multiplier / 100);
								}),
							]),
						)
					: null,
				members: bandMembers,
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
