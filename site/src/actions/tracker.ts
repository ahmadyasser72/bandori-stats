import { ActionError, defineAction } from "astro:actions";

import { z } from "zod";

import dayjs, { formatDuration } from "@bandori-stats/bestdori/date";
import { stripBB } from "@bandori-stats/bestdori/helpers";
import { db } from "@bandori-stats/database";
import {
	GBP,
	redis,
	type NotifyWhenPlayer,
} from "@bandori-stats/database/redis";
import { getTrackingMetadata } from "@bandori-stats/database/tracker";

export const notifyMe = defineAction({
	accept: "json",
	input: z.object({
		subscription: z.object({
			endpoint: z.url(),
			expirationTime: z.number().nullable(),
			keys: z.object({ p256dh: z.string(), auth: z.string() }),
		}),
		target: z.object({
			uid: z.string(),
			kind: z.enum(["event", "monthly"]),
			id: z.number(),
		}),
		on: z.discriminatedUnion("target", [
			z.object({
				target: z.literal("play-again"),
				value: z.number().min(1).max(1),
			}),
			z.object({
				target: z.literal("point"),
				value: z.number().positive(),
			}),
			z.object({
				target: z.literal("boated-from"),
				value: z.number().min(1).max(10),
			}),
		]),
	}),
	handler: async ({ subscription, target, on }) => {
		const metadata = await getTrackingMetadata(target);
		if (!metadata)
			throw new ActionError({
				code: "NOT_FOUND",
				message: `${target.kind}:${target.id} doesn't exists!`,
			});
		else if (dayjs().isAfter(metadata.endAt))
			throw new ActionError({
				code: "BAD_GATEWAY",
				message: `${target.kind}:${target.id} already ended!`,
			});

		const latestSnapshot = await db().query.trackerSnapshots.findFirst({
			columns: { name: true, point: true, rank: true, timestamp: true },
			where: target,
			orderBy: { id: "desc" },
		});
		if (!latestSnapshot)
			throw new ActionError({
				code: "NOT_FOUND",
				message: `${target.uid} is not tracked in ${target.kind}:${target.id}!`,
			});

		if (on.target === "play-again") {
			const sinceLastPlayed = dayjs().diff(latestSnapshot.timestamp, "minutes");
			if (sinceLastPlayed <= 60)
				throw new ActionError({
					code: "BAD_REQUEST",
					message: `${stripBB(latestSnapshot.name)} recently played ${formatDuration({ from: latestSnapshot.timestamp })}!`,
				});
		}
		if (on.target === "point" && latestSnapshot.point > on.value)
			throw new ActionError({
				code: "BAD_REQUEST",
				message: `${stripBB(latestSnapshot.name)} points already above ${on.value}!`,
			});
		if (on.target === "boated-from" && latestSnapshot.rank > on.value)
			throw new ActionError({
				code: "BAD_REQUEST",
				message: `${stripBB(latestSnapshot.name)} already boated from rank #${on.value}!`,
			});

		const key = GBP.fromMetadata(target, "notify", target.uid);
		const payload = {
			on,
			subscription,
			createdAt: new Date(),
		} satisfies NotifyWhenPlayer;

		const exists = await redis().exists(key);
		if (exists) await redis().json.arrappend(key, "$", payload);
		else
			await redis()
				.multi()
				.json.set(key, "$", [payload])
				.pexpireat(key, metadata.endAt.valueOf())
				.exec();
	},
});

export const discordWebhook = defineAction({
	accept: "json",
	input: z.object({
		target: z.object({ kind: z.enum(["event", "monthly"]), id: z.number() }),
		url: z
			.httpUrl()
			.transform((url) => new URL(url))
			.refine((url) => url.host.match(/discord(?:app)?\.com$/), {
				error: "Webhook URL must be from Discord!",
			})
			.refine(
				(url) =>
					url.pathname.match(/^\/api\/webhooks\/(\d+)\/([a-zA-Z0-9_-]+)$/),
				{ error: "Webhook URL is invalid!" },
			),
	}),
	handler: async ({ url, target }) => {
		const metadata = await getTrackingMetadata(target);
		if (!metadata)
			throw new ActionError({
				code: "NOT_FOUND",
				message: `${target.kind}:${target.id} doesn't exists!`,
			});
		else if (dayjs().isAfter(metadata.endAt))
			throw new ActionError({
				code: "BAD_GATEWAY",
				message: `${target.kind}:${target.id} already ended!`,
			});

		const response = await fetch(url);
		if (!response.ok)
			throw new ActionError({
				code: "BAD_REQUEST",
				message: "Webhook URL is invalid!",
			});

		const key = GBP.fromMetadata(target, "discord-webhook");
		const exists = await redis().exists(key);
		if (exists) {
			const added = await redis().sadd(key, url);
			if (added === 0)
				throw new ActionError({
					code: "BAD_REQUEST",
					message: "Webhook already subscribed!",
				});
		} else {
			await redis()
				.multi()
				.sadd(key, url)
				.pexpireat(key, metadata.endAt.valueOf())
				.exec();
		}
	},
});
