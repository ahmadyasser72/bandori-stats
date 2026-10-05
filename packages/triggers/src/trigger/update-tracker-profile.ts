import { AbortTaskRunError, logger, schemaTask, tags } from "@trigger.dev/sdk";
import { allKeyed, capitalize, mapValues, pick, sumBy, uniq } from "es-toolkit";
import z from "zod";

import { unwrapRegionTuple } from "@bandori-stats/bestdori/helpers";
import { Skills } from "@bandori-stats/bestdori/schema/skills";
import { and, db, eq, sql } from "@bandori-stats/database";
import {
	CHARACTER_TO_BAND,
	GBP,
	getRedisData,
	redis,
	type BangDreamAreaItem,
	type BangDreamCard,
	type BangDreamCredentials,
} from "@bandori-stats/database/redis";
import { trackerSnapshotProfiles } from "@bandori-stats/database/schema";
import {
	STAT_TYPES,
	TrackingReference,
	type PlayerBandMember,
	type PlayerBandMemberStateless,
} from "@bandori-stats/database/tracker";
import { bangDreamProfile } from "~/bang-dream-gbp/fetch";
import type {
	UserProfileSituation,
	UserSituation,
} from "~/bang-dream-gbp/gen/common_pb";
import type { UserProfile } from "~/bang-dream-gbp/gen/profile_pb";
import { bestdori } from "~/bestdori";

export const updateTrackerProfile = schemaTask({
	id: "update-tracker-profile",
	queue: { concurrencyLimit: 1 },
	schema: z.object({
		version: z.string(),
		players: z
			.array(
				z.object({
					uid: z.string(),
					trackingReference: TrackingReference,
					changed: z.boolean(),
				}),
			)
			.nonempty(),
	}),
	run: async ({ players, version }) => {
		await tags.add(`version_${version}`);

		const profiles = await logger.trace("fetch-profiles", async (span) => {
			let auth = await redis().json.get<BangDreamCredentials>(GBP.credentials);
			if (!auth)
				throw new AbortTaskRunError("BanG Dream credentials are missing.");

			const uids = uniq(players.map(({ uid }) => uid));
			span.setAttribute("uids", uids);

			const profiles = new Map<string, UserProfile>();
			for (const uid of uids) {
				const profile = await bangDreamProfile(version, auth, uid);
				auth = profile.credentials;
				profiles.set(uid, profile);
			}

			await redis().json.set(GBP.credentials, "$.token", `"${auth.token}"`);
			return profiles;
		});

		const { data, skills } = await allKeyed({
			data: logger.trace("fetch-redis-data", (span) => {
				const areaItems = [...profiles.values()].flatMap(
					({ enabledUserAreaItems }) =>
						enabledUserAreaItems?.entries.map(({ areaItemId }) => areaItemId) ??
						[],
				);
				span.setAttribute("areaItems", areaItems);
				const cards = [...profiles.values()].flatMap(
					({ userProfileSituation, mainDeckUserSituations }) => [
						userProfileSituation?.situationId,
						...(mainDeckUserSituations?.entries.map(
							({ situationId }) => situationId,
						) ?? []),
					],
				);
				span.setAttribute("cards", cards);

				return getRedisData({ areaItems, cards });
			}),
			skills: logger.trace("fetch-skills", () =>
				bestdori({ path: "api/skills/all.10.json", schema: Skills }),
			),
		});

		const values: (
			| typeof trackerSnapshotProfiles.$inferInsert
			| (Omit<typeof trackerSnapshotProfiles.$inferInsert, "band"> & {
					band: undefined;
			  })
		)[] = players
			.map(({ uid, trackingReference, changed }) => {
				const profile = profiles.get(uid);
				if (!profile) return null;

				const bandAreaItems = (profile.enabledUserAreaItems?.entries ?? []).map(
					({ areaItemId }) => data.areaItems[areaItemId],
				);
				const bandMembers = (profile.mainDeckUserSituations?.entries ?? []).map(
					(member) =>
						getBandMember(member, data.cards[member.situationId], skills),
				);

				return {
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
									data.cards[profile.userProfileSituation.situationId],
								)
							: null,

					band: changed
						? {
								name: profile.mainUserDeck?.deckName!,
								members: bandMembers,
								areaItems: bandAreaItems.length > 0 ? bandAreaItems : null,
								totalStats: profile.publishTotalDeckPowerFlg
									? calculateTotalBandStats(bandMembers, bandAreaItems)
									: null,
							}
						: undefined,

					titles: Object.values(
						profile.userProfileDegreeMap?.entries ?? {},
					).map(({ degreeId }) => degreeId),
				};
			})
			.filter((value) => value !== null);

		const toInsert = values.filter((profile) => profile.band !== undefined);
		const upsertProfiles = () =>
			db()
				.insert(trackerSnapshotProfiles)
				.values(toInsert)
				.onConflictDoUpdate({
					target: [
						trackerSnapshotProfiles.uid,
						trackerSnapshotProfiles.trackingFor,
						trackerSnapshotProfiles.trackingId,
						trackerSnapshotProfiles.trackingEventId,
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

		const toUpdate = values.filter((profile) => profile.band === undefined);
		const updateProfiles = () =>
			toUpdate.map(
				({ trackingFor, trackingId, trackingEventId, uid, ...value }) =>
					db()
						.update(trackerSnapshotProfiles)
						.set(value)
						.where(
							and(
								eq(trackerSnapshotProfiles.trackingFor, trackingFor),
								eq(trackerSnapshotProfiles.trackingId, trackingId),
								eq(trackerSnapshotProfiles.trackingEventId, trackingEventId!),
								eq(trackerSnapshotProfiles.uid, uid),
							),
						),
			);

		await db().batch([
			...(toInsert.length > 0 ? [upsertProfiles()] : []),
			...updateProfiles(),
		] as [ReturnType<typeof upsertProfiles>]);
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

const getBandMember = (
	data: UserSituation,
	card: BangDreamCard,
	skills: z.infer<typeof Skills>,
) => {
	const stat = card.parameterMap[data.level]
		? mapValues(card.parameterMap[data.level], (base, type) => {
				if (!data.userAppendParameter) return base;

				data.userAppendParameter[type] ??= 0;
				data.userAppendParameter[`characterPotential${capitalize(type)}`] ??= 0;
				data.userAppendParameter[`characterBonus${capitalize(type)}`] ??= 0;

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
