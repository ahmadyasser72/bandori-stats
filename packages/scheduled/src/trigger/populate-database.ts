import { schemaTask } from "@trigger.dev/sdk";
import dayjs from "dayjs";
import z from "zod";

import { insertSnapshot } from "./insert-snapshot";

export const populateDatabase = schemaTask({
	id: "populate-database",
	schema: z.strictObject({
		usernames: z.array(z.string().nonempty()).nonempty(),
		date: z.iso.date(),
	}),
	run: async ({ usernames, date }, { ctx }) => {
		await insertSnapshot.batchTrigger(
			usernames.map((username) => ({
				payload: { username, date },
				options: {
					delay: dayjs(ctx.run.startedAt)
						.add(Math.random() * 60)
						.toDate(),
					tags: `${username}/${date}`,
					idempotencyKey: `insert-${username}:${date}`,
					idempotencyKeyTTL: "1d",
				},
			})),
		);
	},
});
