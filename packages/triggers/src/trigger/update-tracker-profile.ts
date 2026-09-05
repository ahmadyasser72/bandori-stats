import { logger, schemaTask, tags } from "@trigger.dev/sdk";
import { allKeyed, capitalize, mapValues, pick, sumBy } from "es-toolkit";
import z from "zod";

import { unwrapRegionTuple } from "@bandori-stats/bestdori/helpers";
import { Skills } from "@bandori-stats/bestdori/schema/skills";
import { db, sql } from "@bandori-stats/database";
import {
	GBP,
	getAreaItems,
	getCards,
	redis,
	type BangDreamAreaItem,
	type BangDreamCard,
} from "@bandori-stats/database/redis";
import { trackerSnapshotProfiles } from "@bandori-stats/database/schema";
import {
	STAT_TYPES,
	TRACKER_KIND,
	type PlayerBandMember,
	type PlayerBandMemberStateless,
} from "@bandori-stats/database/tracker";
import { bangDreamProfile } from "~/bang-dream-gbp/fetch";
import type {
	UserProfileSituation,
	UserSituation,
} from "~/bang-dream-gbp/gen/common_pb";
import type {
	UserProfile,
	UserProfileJson,
} from "~/bang-dream-gbp/gen/profile_pb";
import { bestdori, CHARACTER_TO_BAND } from "~/bestdori";
import { githubRedeploy } from "~/github";

export const updateTrackerProfile = schemaTask({
	id: "update-tracker-profile",
	schema: z.object({
		players: z.array(
			z.object({
				uid: z.string(),
				trackingReference: z.object({
					trackingFor: z.enum(TRACKER_KIND),
					trackingId: z.number(),
				}),
			}),
		),
	}),
	run: async ({ players }, { ctx }) => {
		const version = await redis().get<string>(GBP.version);
		await tags.add(`version_${version ?? "n/a"}`);
		if (!version) return;

		const profiles = await logger.trace("fetch-profiles", async (span) => {
			const getFromCache = new Set<string>();
			for (const { uid, trackingReference } of players) {
				if (trackingReference.trackingFor === "music") {
					getFromCache.delete(uid);
					span.setAttribute?.(uid, "no-cache");
				} else {
					getFromCache.add(uid);
				}
			}

			const getProfileCacheKey = (uid: string) => `gbp:profile:${uid}`;

			const uids = [...getFromCache];
			const fromRedis = await redis().mget<(UserProfile | null)[]>(
				...uids.map(getProfileCacheKey),
			);

			const USED_FIELDS = [
				"mainUserDeck",
				"userProfileDegreeMap",
				"enabledUserAreaItems",
				"mainDeckUserSituations",
				"userName",
				"rank",
				"introduction",
				"publishTotalDeckPowerFlg",
				"userProfileSituation",
			] as const;
			type UsedFields = (typeof USED_FIELDS)[number];

			const profiles = new Map<string, Pick<UserProfile, UsedFields>>();
			for (const [idx, profile] of fromRedis.entries()) {
				const uid = uids[idx];
				if (profile) {
					profiles.set(uid, profile);
					span.setAttribute?.(uid, "cache-hit");
				} else {
					span.setAttribute?.(uid, "cache-miss");
				}
			}

			const profilesToCache = [] as [
				string,
				Pick<UserProfileJson, UsedFields>,
			][];
			for (const { uid } of players) {
				if (profiles.has(uid)) continue;

				const profile = await bangDreamProfile(version, uid);
				profiles.set(uid, profile);
				profilesToCache.push([
					getProfileCacheKey(uid),
					pick(profile.json, USED_FIELDS),
				]);
			}

			if (profilesToCache.length > 0) {
				const pipe = redis().pipeline();
				for (const [key, profile] of profilesToCache)
					pipe.set(key, profile, { ex: 60 * 60 });
				await pipe.exec();
			}

			return profiles;
		});
		if (profiles.size === 0) return;

		const { areaItems, cards, skills } = await logger.trace(
			"fetch-area-items-skills",
			() =>
				allKeyed({
					areaItems: getAreaItems(
						[...profiles.values()].flatMap(
							({ enabledUserAreaItems }) =>
								enabledUserAreaItems?.entries.map(
									({ areaItemId }) => areaItemId,
								) ?? [],
						),
					),
					cards: getCards(
						[...profiles.values()].flatMap(
							({ userProfileSituation, mainDeckUserSituations }) => [
								userProfileSituation?.situationId,
								...(mainDeckUserSituations?.entries.map(
									({ situationId }) => situationId,
								) ?? []),
							],
						),
					),
					skills: bestdori({
						path: "api/skills/all.10.json",
						schema: Skills,
					}),
				}),
		);

		const values: (typeof trackerSnapshotProfiles.$inferInsert | null)[] =
			await Promise.all(
				players.map(async ({ uid, trackingReference }) => {
					const profile = profiles.get(uid);
					if (!profile) return null;

					return logger.trace("generate-value", async (span) => {
						span.setAttributes?.({ uid, ...trackingReference });

						const bandMembers = await Promise.all(
							(profile.mainDeckUserSituations?.entries ?? []).map((data) =>
								getBandMember(data, cards[data.situationId], skills),
							),
						);

						return allKeyed({
							...trackingReference,

							uid,
							name: profile.userName,
							level: profile.rank,
							introduction: profile.introduction,
							avatar:
								profile.userProfileSituation &&
								profile.userProfileSituation.situationId
									? getAvatar(
											profile.userProfileSituation,
											cards[profile.userProfileSituation.situationId],
										)
									: null,

							band: {
								name: profile.mainUserDeck?.deckName!,
								totalStats: profile.publishTotalDeckPowerFlg
									? calculateTotalBandStats(
											bandMembers,
											(profile.enabledUserAreaItems?.entries ?? []).map(
												({ areaItemId }) => areaItems[areaItemId],
											),
										)
									: null,
								members: bandMembers,
							},

							titles: Object.values(
								profile.userProfileDegreeMap?.entries ?? {},
							).map(({ degreeId }) => degreeId),
						});
					});
				}),
			);

		const results = await logger.trace("insert-profiles", () =>
			db()
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
				}),
		);

		if (results.rowsAffected > 0) await githubRedeploy(ctx);
	},
});

export const getAvatar = (
	userProfileSituation: UserProfileSituation,
	card: BangDreamCard,
) =>
	({
		id: userProfileSituation.situationId,
		trained: userProfileSituation.illust === "after_training",
		attribute: card.attribute,
		character: card.characterId,
		band: CHARACTER_TO_BAND[card.characterId],
		rarity: card.rarity,
	}) satisfies PlayerBandMemberStateless;

const getBandMember = async (
	data: UserSituation,
	card: BangDreamCard,
	skills: z.infer<typeof Skills>,
) => {
	const stat = card.parameterMap[data.level]
		? mapValues(card.parameterMap[data.level], (base, type) => {
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

const calculateTotalBandStats = (
	bandMembers: Awaited<ReturnType<typeof getBandMember>>[],
	areaItems: BangDreamAreaItem[],
) =>
	Object.fromEntries(
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

const ZERO_STAT = { performance: 0, technique: 0, visual: 0 };
