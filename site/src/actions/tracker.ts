import { ActionError, defineAction } from "astro:actions";

import { z } from "zod";

import dayjs from "@bandori-stats/bestdori/date";
import { GBP, redis } from "@bandori-stats/database/redis";
import {
	getTrackingMetadata,
	TrackingTarget,
} from "@bandori-stats/database/tracker";

export const discordWebhook = defineAction({
	accept: "json",
	input: z.object({
		target: TrackingTarget,
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
