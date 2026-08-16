import { ActionError, defineAction } from "astro:actions";

import { z } from "zod";

import { db } from "@bandori-stats/database";
import {
	GAME_EVENT_CURRENT,
	GAME_MONTHLY_CURRENT,
	redis,
	type NotifyWhenPlayer,
} from "@bandori-stats/database/redis";

export const server = {
	trackerNotify: defineAction({
		accept: "json",
		input: z.object({
			subscription: z.object({
				endpoint: z.string(),
				expirationTime: z.number().nullable(),
				keys: z.object({ p256dh: z.string(), auth: z.string() }),
			}),
			target: z.object({
				uid: z.string(),
				trackingFor: z.enum(["event", "monthly"]),
				trackingId: z.number(),
			}),
			when: z.object({
				point: z.number(),
			}),
		}),
		handler: async ({ subscription, target, when }) => {
			const baseKey = (
				target.trackingFor === "event"
					? GAME_EVENT_CURRENT
					: GAME_MONTHLY_CURRENT
			).replace("current", target.trackingId.toString());
			const key = `${baseKey}:point:${target.uid}`;

			const data = await (target.trackingFor === "event"
				? db().query.gbpEvents.findFirst({
						columns: { startAt: true, endAt: true },
						where: { eventId: target.trackingId },
					})
				: db().query.gbpMonthlyRankings.findFirst({
						columns: { startAt: true, endAt: true },
						where: { monthlyRankingId: target.trackingId },
					}));
			if (!data)
				throw new ActionError({
					code: "NOT_FOUND",
					message: `${target.trackingFor} doesn't exists`,
				});

			const exists = await redis().exists(key);
			if (exists)
				await redis().json.arrappend(key, "$.subscriptions", subscription);
			else
				await redis()
					.multi()
					.json.set(key, "$", {
						when,
						subscriptions: [subscription],
					} satisfies NotifyWhenPlayer)
					.pexpireat(key, data.endAt.valueOf())
					.exec();
		},
	}),
};
