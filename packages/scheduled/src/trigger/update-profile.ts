import { db, eq } from "@bandori-stats/database";
import { accounts } from "@bandori-stats/database/schema";

import { AbortTaskRunError, schemaTask, tags } from "@trigger.dev/sdk";
import z from "zod";

import { bestdoriProfile } from "./bestdori-profile";

export const updateProfile = schemaTask({
	id: "update-profile",
	schema: z.object({ username: z.string().nonempty() }),
	run: async ({ username }) => {
		const { card } = await bestdoriProfile
			.triggerAndWait(
				{ username },
				{ idempotencyKey: `profile_${username}`, tags: `@_${username}` },
			)
			.unwrap();

		const existing = await db.query.accounts.findFirst({
			columns: { id: true, profileArt: true },
			where: { username },
		});
		if (!existing) {
			await tags.add("account_not found");
			throw new AbortTaskRunError(
				`Account with username @${username} doesn't exists`,
			);
		}

		if (
			existing.profileArt?.id !== card?.id ||
			existing.profileArt?.trained !== card?.trainedArt
		) {
			await db
				.update(accounts)
				.set({
					profileArt: card ? { id: card.id, trained: card.trainedArt } : null,
				})
				.where(eq(accounts.id, existing.id));
		}
	},
});
