import { AbortTaskRunError, schedules, tags } from "@trigger.dev/sdk";
import {
	bold,
	ChannelType,
	Guild,
	GuildScheduledEventEntityType,
	GuildScheduledEventPrivacyLevel,
	hyperlink,
	MessageFlags,
	time,
	TimestampStyles,
} from "discord.js";
import { capitalize, uniq } from "es-toolkit";

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
	type GbpEventMusic,
	type GbpMetadata,
} from "@bandori-stats/database/schema";
import type { TrackingTarget } from "@bandori-stats/database/tracker";
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
						pxat: dayjs(event.endAt).add(1, "hour").valueOf(),
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

						const description = (() => {
							const lines = [] as string[];

							lines.push(bold("Event Period:"), formatPeriod(event));

							const attribute = (() => {
								const value = metadata.attributes.at(0)?.attribute ?? "unknown";
								return value
									? `${emoji(`attribute_${value}`)}  `
									: "(Unknown attribute)";
							})();
							lines.push(
								bold("Event Type:"),
								`${attribute} ${formatEventType(eventType)}`,
							);

							const characters = Object.keys(metadata.characters)
								.map(Number)
								.map((id) => {
									const { nickname, firstName } =
										data.masterCharacterInfoMap[id];
									return { id, name: nickname ?? firstName };
								});
							lines.push(
								bold("Characters:"),
								characters
									.map(
										({ id, name }) => `${emoji(`character_${id}`)}   ${name}`,
									)
									.join("  "),
							);

							lines.push(
								"",
								`${emoji("bestdori")}   https://bestdori.com/info/events/${eventId}`,
							);

							return lines.map((line) => line.trim()).join("\n");
						})();

						const payload = {
							title: `#${eventId} ${eventName}`,
							image: await fetchLogo(event),
							description,
						};

						const scheduledEvent = await createScheduledEvent(guild, {
							metadata: event,
							payload,
						});

						const forumId = process.env.DISCORD_EVENT_TRACKER_FORUM_ID;
						if (!forumId)
							throw new AbortTaskRunError(
								"DISCORD_EVENT_TRACKER_FORUM_ID is not defined.",
							);

						const startAt = dayjs.tz(event.startAt);
						const bands = uniq(
							Object.keys(metadata.characters)
								.map(Number)
								.map(
									(id) => data.masterBandMap[CHARACTER_TO_BAND[id]].bandName,
								),
						);
						const tags = [
							startAt.format("MMMM"),
							startAt.format("YYYY"),
							capitalize(metadata.attributes.at(0)?.attribute ?? "unknown"),
							formatEventType(eventType),
							bands.length > 1 ? "Mixed" : bands[0],
						];

						const eventThread = await createThread(guild, {
							forumId,
							payload,
							target: { kind: "event" as const, id: eventId },
							keySuffix: "discord-thread",
							tags,
						});

						if (musics.length === 0) {
							await scheduledEvent.setDescription(
								[scheduledEvent.description!, eventThread.url].join("\n"),
							);
						} else if (musics.length > 0) {
							const title = `${payload.title} — ${musics.map(({ musicTitle }) => musicTitle).join(" / ")}`;
							const description = [
								bold(musics.length === 1 ? "Event song:" : "Event songs:"),
								...musics.map(({ musicId, musicTitle, bandId }) => {
									const band = data.masterBandMap[bandId];
									return (
										`${emoji(`band_${bandId}`)}  ` +
										hyperlink(
											`${band.bandName} - ${musicTitle}`,
											`https://bestdori.com/info/songs/${musicId}`,
										)
									);
								}),
								"",
								eventThread.url,
							].join("\n");
							const image = [
								payload.image,
								...(await Promise.all(
									musics.map(({ musicId: id, jacketImage }) =>
										fetchAlbumCover({ id, jacketImage }),
									),
								)),
							];

							const musicThread = await createThread(guild, {
								forumId,
								payload: { title, description, image },
								target: { kind: "event" as const, id: eventId },
								keySuffix: "discord-thread-musics",
								tags,
							});

							const eventThreadMessage =
								await eventThread.fetchStarterMessage();
							if (eventThreadMessage)
								await eventThreadMessage.edit(
									[eventThreadMessage.content, musicThread.url].join("\n"),
								);

							await scheduledEvent.setDescription(
								[
									scheduledEvent.description!,
									eventThread.url,
									musicThread.url,
								].join("\n"),
							);
						}
					});

					return true;
				})(),
			!currentMonthly &&
				(async () => {
					const active = data.masterMonthlyRankingList.find(({ endAt }) =>
						dayjs().isSame(endAt, "month"),
					);
					if (!active) return;

					const { monthlyRankingId, monthlyRankingName, ...monthly } = active;
					await db()
						.insert(gbpMonthlyRankings)
						.values({
							id: monthlyRankingId,
							name: monthlyRankingName,
							...monthly,
						});
					await redis().set(GBP.monthly.current, monthlyRankingId, {
						pxat: dayjs(monthly.endAt).add(1, "hour").valueOf(),
					});
					await tags.add(`monthly_${monthly.assetBundleName}`);

					await useDiscordBot(async ({ guild }) => {
						const payload = {
							title: `#${monthlyRankingId} ${monthlyRankingName}`,
							description: [bold("Period:"), formatPeriod(monthly)].join("\n"),
							image: await fetchLogo(monthly),
						};

						const scheduledEvent = await createScheduledEvent(guild, {
							metadata: monthly,
							payload,
						});

						const forumId = process.env.DISCORD_MONTHLY_TRACKER_FORUM_ID;
						if (!forumId)
							throw new AbortTaskRunError(
								"DISCORD_MONTHLY_TRACKER_FORUM_ID is not defined.",
							);

						const startAt = dayjs(monthly.startAt);
						const monthlyThread = await createThread(guild, {
							forumId,
							payload,
							target: { kind: "monthly" as const, id: monthlyRankingId },
							keySuffix: "discord-thread",
							tags: [startAt.format("MMMM"), startAt.format("YYYY")],
						});

						await scheduledEvent.setDescription(
							[scheduledEvent.description!, monthlyThread.url].join("\n"),
						);
					});

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

const formatPeriod = ({
	startAt,
	endAt,
}: Pick<GbpMetadata, "startAt" | "endAt">) =>
	[startAt, endAt]
		.map((date) => time(date, TimestampStyles.ShortDateMediumTime))
		.join(" — ");
const fetchLogo = ({ assetBundleName }: Pick<GbpMetadata, "assetBundleName">) =>
	bestdori({
		path: `/assets/en/event/${assetBundleName}/images_rip/logo.png`,
		schema: false,
	})
		.then((response) => response.arrayBuffer())
		.then(Buffer.from);
const fetchAlbumCover = async ({
	id,
	jacketImage,
}: Pick<GbpEventMusic, "id" | "jacketImage">) => {
	const chunk = 10 * Math.ceil(id / 10);
	return bestdori({
		path: `/assets/en/musicjacket/musicjacket${chunk}_rip/assets-star-forassetbundle-startapp-musicjacket-musicjacket${chunk}-${jacketImage.toLowerCase()}-jacket.png`,
		schema: false,
	})
		.then((response) => response.arrayBuffer())
		.then(Buffer.from);
};

interface MetadataPayload {
	title: string;
	description: string;
	image: Buffer;
}

interface CreateScheduledEventOptions {
	metadata: Pick<GbpMetadata, "startAt" | "endAt">;
	payload: MetadataPayload;
}

const createScheduledEvent = (
	guild: Guild,
	{ metadata, payload }: CreateScheduledEventOptions,
) =>
	guild.scheduledEvents.create({
		name: payload.title,
		entityType: GuildScheduledEventEntityType.External,
		privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
		scheduledStartTime: metadata.startAt,
		scheduledEndTime: metadata.endAt,

		image: payload.image,
		entityMetadata: { location: "BanG Dream" },
		description: payload.description,
	});

interface CreateThreadOptions {
	payload: Omit<MetadataPayload, "image"> & { image: Buffer | Buffer[] };
	forumId: string;
	target: TrackingTarget;
	keySuffix: string;
	tags: string[];
}

const createThread = async (
	guild: Guild,
	{ forumId, target, tags, payload, keySuffix }: CreateThreadOptions,
) => {
	const forum = await guild.channels.fetch(forumId);
	if (!forum || forum.type !== ChannelType.GuildForum)
		throw new AbortTaskRunError(`${forumId} channel is not a forum.`);

	const availableTags = new Set(forum.availableTags.map(({ name }) => name));
	const newTags = tags.filter((tag) => !availableTags.has(tag));
	if (newTags.length > 0)
		await forum.setAvailableTags([
			...forum.availableTags,
			...newTags.map((name) => ({ name })),
		]);

	const thread = await forum.threads.create({
		name: payload.title,
		message: {
			content: payload.description,
			files: Array.isArray(payload.image) ? payload.image : [payload.image],
			flags: MessageFlags.SuppressEmbeds,
		},
		appliedTags: tags.map(
			(name) => forum.availableTags.find((tag) => tag.name === name)!.id,
		),
	});
	await redis().set(GBP.fromMetadata(target, keySuffix), thread.id);

	return thread;
};
