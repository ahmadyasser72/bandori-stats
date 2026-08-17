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
			on: z.object({
				target: z.enum(["point", "boated-from"]),
				value: z.number(),
			}),
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
					message: `${target.trackingFor}:${target.trackingId} doesn't exists`,
				});

			const latestSnapshot = await db().query.trackerSnapshots.findFirst({
				columns: { point: true, rank: true },
				where: target,
				orderBy: { id: "desc" },
			});
			if (!latestSnapshot)
				throw new ActionError({
					code: "NOT_FOUND",
					message: `${target.uid} is not tracked in ${target.trackingFor}:${target.trackingId}`,
				});

			if (on.target === "point" && latestSnapshot.point > on.value)
				throw new ActionError({
					code: "BAD_REQUEST",
					message: `${target.uid} points already above ${on.value}!`,
				});
			if (on.target === "boated-from" && latestSnapshot.rank > on.value)
				throw new ActionError({
					code: "BAD_REQUEST",
					message: `${target.uid} already boated from rank #${on.value}!`,
				});

			const baseKey = (
				target.trackingFor === "event"
					? GAME_EVENT_CURRENT
					: GAME_MONTHLY_CURRENT
			).replace("current", target.trackingId.toString());
			const key = `${baseKey}:${target.uid}`;

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
	}),
};
