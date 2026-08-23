import { schemaTask, tags } from "@trigger.dev/sdk/v3";
import z from "zod";

import { PlayerProfile } from "@bandori-stats/bestdori/schema/player/profile";
import { bestdori, bestdoriQueue } from "~/bestdori";

export const bestdoriProfile = schemaTask({
	id: "bestdori-profile",
	queue: bestdoriQueue,
	schema: z.object({ username: z.string().nonempty() }),
	run: async ({ username }) => {
		const data = await bestdori({
			path: "api/user",
			schema: PlayerProfile,
			query: { username },
		});

		const { posterCard: card } = data;
		if (card) await tags.add([`card_${card.id}`, `trained_${card.trainedArt}`]);

		return { card };
	},
});
