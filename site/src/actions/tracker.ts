import { ActionError, defineAction } from "astro:actions";

import { z } from "zod";

import dayjs, { formatDuration } from "@bandori-stats/bestdori/date";
import { db } from "@bandori-stats/database";
import {
	GBP,
	redis,
	type NotifyWhenPlayer,
} from "@bandori-stats/database/redis";

export const notifyMe = defineAction({
	accept: "json",
	input: z.object({
		subscription: z.object({
			endpoint: z.url(),
			expirationTime: z.number().nullable(),
			keys: z.object({ p256dh: z.string(), auth: z.string() }),
		}),
		target: z.object({
			trackingFor: z.enum(["event", "monthly"]),
			trackingId: z.number(),
			uid: z.string(),
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
		const metadata = await (target.trackingFor === "event"
			? db().query.gbpEvents.findFirst({
					columns: { endAt: true },
					where: { eventId: target.trackingId },
				})
			: db().query.gbpMonthlyRankings.findFirst({
					columns: { endAt: true },
					where: { monthlyRankingId: target.trackingId },
				}));
		if (!metadata)
			throw new ActionError({
				code: "NOT_FOUND",
				message: `${target.trackingFor}:${target.trackingId} doesn't exists!`,
			});
		else if (dayjs().isAfter(metadata.endAt))
			throw new ActionError({
				code: "BAD_GATEWAY",
				message: `${target.trackingFor}:${target.trackingId} already ended!`,
			});

		const latestSnapshot = await db().query.trackerSnapshots.findFirst({
			columns: { name: true, point: true, rank: true, timestamp: true },
			where: target,
			orderBy: { id: "desc" },
		});
		if (!latestSnapshot)
			throw new ActionError({
				code: "NOT_FOUND",
				message: `${target.uid} is not tracked in ${target.trackingFor}:${target.trackingId}!`,
			});

		if (on.target === "play-again") {
			const sinceLastPlayed = dayjs().diff(latestSnapshot.timestamp, "minutes");
			if (sinceLastPlayed <= 60)
				throw new ActionError({
					code: "BAD_REQUEST",
					message: `${latestSnapshot.name} recently played ${formatDuration(dayjs(), dayjs(latestSnapshot.timestamp))}!`,
				});
		}
		if (on.target === "point" && latestSnapshot.point > on.value)
			throw new ActionError({
				code: "BAD_REQUEST",
				message: `${latestSnapshot.name} points already above ${on.value}!`,
			});
		if (on.target === "boated-from" && latestSnapshot.rank > on.value)
			throw new ActionError({
				code: "BAD_REQUEST",
				message: `${latestSnapshot.name} already boated from rank #${on.value}!`,
			});

		const baseKey = GBP[target.trackingFor][target.trackingId];
		const key = `${baseKey}:notify:${target.uid}`;

		const notify = { on, subscription } satisfies NotifyWhenPlayer;
		const exists = await redis().exists(key);
		if (exists) await redis().json.arrappend(key, "$", notify);
		else
			await redis()
				.multi()
				.json.set(key, "$", [notify])
				.pexpireat(key, metadata.endAt.valueOf())
				.exec();
	},
});
