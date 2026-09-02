import { schedules, tags } from "@trigger.dev/sdk";
import {
	Client,
	GuildScheduledEventEntityType,
	GuildScheduledEventPrivacyLevel,
} from "discord.js";
import { capitalize, omit } from "es-toolkit";

import { GBP_TIMEZONE } from "@bandori-stats/bestdori/constants";
import dayjs from "@bandori-stats/bestdori/date";
import { formatEventType } from "@bandori-stats/bestdori/helpers";
import { EventMetadata } from "@bandori-stats/bestdori/schema/events";
import { MasterDB, Versions } from "@bandori-stats/bestdori/schema/misc";
import { db } from "@bandori-stats/database";
import { GBP, redis } from "@bandori-stats/database/redis";
import { gbpEvents, gbpMonthlyRankings } from "@bandori-stats/database/schema";
import { bestdori } from "~/bestdori";
import { githubRedeploy } from "./github-redeploy";

export const scheduleUpdateTrackerMetadata = schedules.task({
	id: "schedule-update-tracker-metadata",
	cron: { pattern: "0 */12 * * *", timezone: GBP_TIMEZONE },
	machine: "small-2x",
	run: async () => {
		const [currentVersion, currentEvent, currentMonthly, areaItems] =
			await redis().mget<(unknown | null)[]>(
				GBP.version,
				GBP.event.current,
				GBP.monthly.current,
				GBP.areaItems,
			);

		{
			const versions = await bestdori({
				path: "api/Versions_en.json",
				schema: Versions,
			});
			if (currentVersion !== versions.app) {
				await redis().set(GBP.version, versions.app);
				await tags.add(`version_${versions.app}`);
			}
		}

		if (currentEvent && currentMonthly && areaItems) return;

		const data = await bestdori({
			path: "api/MasterDB_en.json",
			schema: MasterDB,
		});

		const results = await Promise.allSettled([
			!currentEvent &&
				(async () => {
					const events = Object.values(data.masterEventMap.entries);
					if (events.length === 0) return;

					const event = events.find(({ startAt }) => dayjs().isBefore(startAt));
					if (!event) return;

					const { bannerAssetBundleName, ...metadata } = await bestdori({
						path: `/api/events/${event.eventId}.json`,
						schema: EventMetadata,
					});
					await db()
						.insert(gbpEvents)
						.values({
							id: event.eventId,
							name: event.eventName,
							type: event.eventType,
							...omit(event, ["eventId", "eventName", "eventType"]),
							bannerAssetBundleName,
							metadata,
						});
					await redis().set(GBP.event.current, event.eventId, {
						pxat: event.endAt.getTime(),
					});
					await tags.add(`event_${event.assetBundleName}`);

					const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID } = process.env;
					if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) return;

					const client = new Client({ intents: [] });
					try {
						await client.login(DISCORD_BOT_TOKEN);

						const attribute = metadata.attributes.at(0)?.attribute ?? "unknown";
						const characters = metadata.characters.map(
							({ characterId }) =>
								data.masterCharacterInfoMap.entries[characterId].firstName,
						);
						const banner = await bestdori({
							path: `/assets/en/homebanner_rip/${bannerAssetBundleName}.png`,
							schema: false,
						}).then((response) => response.arrayBuffer());

						const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
						await guild.scheduledEvents.create({
							name: `#${event.eventId} ${event.eventName}`,
							entityType: GuildScheduledEventEntityType.External,
							privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
							scheduledStartTime: event.startAt,
							scheduledEndTime: event.endAt,

							image: Buffer.from(banner),
							entityMetadata: { location: "BanG Dream" },
							description: [
								`Type: ${formatEventType(event.eventType)}`,
								`Attribute: ${capitalize(attribute)}`,
								`Characters: ${characters.join(", ")}`,
								"",
								`https://bestdori.com/info/events/${event.eventId}`,
							].join("\n"),
						});
					} finally {
						await client.destroy();
					}

					return true;
				})(),
			!currentMonthly &&
				(async () => {
					const monthly = data.masterMonthlyRankingList.entries.find(
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
			!areaItems &&
				redis().json.set(GBP.areaItems, "$", data.masterAreaItemMap.entries),
		]);

		const errors = results.filter((promise) => promise.status === "rejected");
		for (const { reason } of errors) console.error(reason);

		if (
			results.some(
				(promise) => promise.status === "fulfilled" && promise.value === true,
			)
		)
			await githubRedeploy.trigger();
	},
});
