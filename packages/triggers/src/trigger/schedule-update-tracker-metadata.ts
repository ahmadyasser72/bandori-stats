import { schedules, tags } from "@trigger.dev/sdk";
import {
	GuildScheduledEventEntityType,
	GuildScheduledEventPrivacyLevel,
	hyperlink,
	underline,
} from "discord.js";
import { capitalize, groupBy, omit } from "es-toolkit";

import { GBP_TIMEZONE } from "@bandori-stats/bestdori/constants";
import dayjs from "@bandori-stats/bestdori/date";
import { formatEventType } from "@bandori-stats/bestdori/helpers";
import { MasterDB, Versions } from "@bandori-stats/bestdori/schema/misc";
import { db } from "@bandori-stats/database";
import {
	GBP,
	redis,
	type BangDreamAreaItem,
	type BangDreamCard,
} from "@bandori-stats/database/redis";
import {
	gbpEventMusics,
	gbpEvents,
	gbpMonthlyRankings,
} from "@bandori-stats/database/schema";
import { bestdori, CHARACTER_TO_BAND } from "~/bestdori";
import { useDiscordBot } from "~/discord";
import { githubRedeploy } from "~/github";

export const scheduleUpdateTrackerMetadata = schedules.task({
	id: "schedule-update-tracker-metadata",
	cron: { pattern: "0 */12 * * *", timezone: GBP_TIMEZONE },
	machine: "medium-1x",
	run: async (_, { ctx }) => {
		const [currentVersion, currentEvent, currentMonthly] = await redis()
			.pipeline()
			.get(GBP.version)
			.exists(GBP.event.current)
			.exists(GBP.monthly.current)
			.exec<[string, ...boolean[]]>();

		const versions = await bestdori({
			path: "api/Versions_en.json",
			schema: Versions,
			cache: false,
		});
		const newVersion = currentVersion !== versions.app;
		if (newVersion) {
			await redis().set(GBP.version, versions.app);
			await tags.add(`version_${versions.app}`);
		}

		if (!newVersion && currentEvent && currentMonthly) return;

		const data = await bestdori({
			path: "api/MasterDB_en.json",
			schema: MasterDB,
			cache: false,
		});

		const results = await Promise.allSettled([
			!currentEvent &&
				(async () => {
					const events = Object.values(data.masterEventMap);
					if (events.length === 0) return;

					const active = events.find(({ startAt }) =>
						dayjs().isBefore(startAt),
					);
					if (!active) return;

					const { eventId, eventName, eventType, ...event } = active;
					const bannerAssetBundleName = `banner_event${eventId}`;
					const metadata = (() => {
						const typ = (() => {
							if (eventType === "live_try") return "LiveTry";
							else if (eventType === "mission_live") return "MissionLive";
							else return capitalize(eventType);
						})();

						return data[`master${typ}EventMap`]![eventId];
					})();
					await db()
						.insert(gbpEvents)
						.values({
							id: eventId,
							name: eventName,
							type: eventType,
							...event,
							bannerAssetBundleName,
							metadata,
						});
					await redis().set(GBP.event.current, eventId, {
						pxat: event.endAt.getTime(),
					});
					await tags.add(`event_${event.assetBundleName}`);

					const musics =
						metadata.musics
							?.map(({ musicId }) =>
								data.masterMusicList.find((it) => it.musicId === musicId),
							)
							.filter((music) => music !== undefined) ?? [];
					if (musics.length > 0) {
						await db()
							.insert(gbpEventMusics)
							.values(
								musics.map(({ bandId, musicId, musicTitle, ...music }) => {
									const { bandName, bandType } = data.masterBandMap[bandId];

									return {
										id: musicId,
										title: musicTitle,
										eventId,
										band: { id: bandId, name: bandName, type: bandType },
										...music,
									};
								}),
							);
						await tags.add(
							musics.map(({ bgmFile }) => `event_${eventType}_${bgmFile}`),
						);
					}

					await useDiscordBot(async ({ client, guild }) => {
						const emojis = await client.application.emojis.fetch();
						const emoji = (name: string) =>
							emojis.find((emoji) => emoji.name === name) ?? "";

						const lines = [underline(formatEventType(eventType))] as string[];
						if (musics.length > 0) {
							lines.push(
								musics.length === 1 ? "Event song" : "Event songs",
								...musics.map(({ musicId, musicTitle, bandId }) => {
									const band = data.masterBandMap[bandId];
									return (
										`${emoji(`band_${bandId}`)} ` +
										hyperlink(
											`${band.bandName} - ${musicTitle}`,
											`https://bestdori.com/info/songs/${musicId}`,
										)
									);
								}),
							);
						}

						const attribute = metadata.attributes.at(0)?.attribute ?? "unknown";
						lines.push(
							attribute === "unknown"
								? "Unknown attribute"
								: `${emoji(`attribute_${attribute}`)} ${capitalize(attribute)}`,
						);

						const bands = groupBy(
							Object.keys(metadata.characters).map((id) => ({
								id,
								band: CHARACTER_TO_BAND[id],
								name: data.masterCharacterInfoMap[id].firstName,
							})),
							({ band }) => band,
						);
						for (const [id, characters] of Object.entries(bands)) {
							const band = data.masterBandMap[id];
							lines.push(
								`${emoji(`band_${id}`)} ${band.bandName}`,
								characters
									.map(({ id, name }) => `${emoji(`character_${id}`)} ${name}`)
									.join(" "),
							);
						}

						lines.push(
							"",
							hyperlink(
								"View on Bestdori!",
								`https://bestdori.com/info/events/${eventId}`,
							),
						);

						const banner = await bestdori({
							path: `/assets/en/homebanner_rip/${bannerAssetBundleName}.png`,
							schema: false,
						}).then((response) => response.arrayBuffer());

						await guild.scheduledEvents.create({
							name: `#${eventId} ${eventName}`,
							entityType: GuildScheduledEventEntityType.External,
							privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
							scheduledStartTime: event.startAt,
							scheduledEndTime: event.endAt,

							image: Buffer.from(banner),
							entityMetadata: { location: "BanG Dream" },
							description: lines.map((line) => line.trim()).join("\n"),
						});
					});

					return true;
				})(),
			!currentMonthly &&
				(async () => {
					const monthly = data.masterMonthlyRankingList.find(
						({ startAt, endAt }) => dayjs().isBetween(startAt, endAt),
					);
					if (!monthly) return;

					await db()
						.insert(gbpMonthlyRankings)
						.values({
							id: monthly.monthlyRankingId,
							name: monthly.monthlyRankingName,
							...omit(monthly, ["monthlyRankingId", "monthlyRankingName"]),
						});
					await redis().set(GBP.monthly.current, monthly.monthlyRankingId, {
						pxat: monthly.endAt.getTime(),
					});
					await tags.add(`monthly_${monthly.assetBundleName}`);

					return true;
				})(),
			currentVersion !== versions.app &&
				redis().mset(
					Object.fromEntries([
						...Object.entries(data.masterAreaItemMap).map(
							([id, value]): [string, BangDreamAreaItem] => [
								GBP.data.AreaItem[id],
								value,
							],
						),
						...Object.entries(data.masterCharacterSituationMap).map(
							([id, { situationSkillId, ...value }]): [
								string,
								BangDreamCard,
							] => [
								GBP.data.CharacterSituation[id],
								{
									...value,
									skillId:
										data.masterSituationSkillMap[situationSkillId].skillId,
								},
							],
						),
					]),
				),
		]);

		const errors = results.filter((promise) => promise.status === "rejected");
		for (const { reason } of errors) console.error(reason);
		if (errors.length > 0) await tags.add("error_settled");

		if (
			results.some(
				(promise) => promise.status === "fulfilled" && promise.value === true,
			)
		)
			await githubRedeploy(ctx);
	},
});
