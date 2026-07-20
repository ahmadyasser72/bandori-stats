import { PlayerProfile } from "@bandori-stats/bestdori/schema/player/profile";

import { AbortTaskRunError, schemaTask, tags } from "@trigger.dev/sdk/v3";
import z from "zod";

import { bestdori, bestdoriQueue } from "../bestdori";

export const bestdoriProfile = schemaTask({
	id: "bestdori-profile",
	queue: bestdoriQueue,
	schema: z.object({ username: z.string().nonempty() }),
	run: async ({ username }) => {
		const { success, data, error } = PlayerProfile.safeParse(
			await bestdori("api/user", { username }),
		);

		if (!success) {
			await tags.add("schema_error");
			throw new AbortTaskRunError(error.message);
		}

		const { posterCard: card } = data;
		if (card) await tags.add([`CARD_${card.id}`, `TRAINED_${card.trainedArt}`]);

		return { card };
	},
});
