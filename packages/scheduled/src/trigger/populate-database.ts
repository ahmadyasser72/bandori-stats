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
	run: async ({ usernames, date }) => {
		const minutesLeft = dayjs()
			.endOf("hours")
			.subtract(5, "minute")
			.diff(dayjs(), "minutes", true);

		await insertSnapshot.batchTrigger(
			usernames
				.map((username) => ({
					payload: { username, date },
					options: {
						delay: dayjs()
							.add(Math.random() * minutesLeft, "minutes")
							.toDate(),
						tags: `snapshot_${username}`,
					},
				}))
				.sort((a, b) => a.options.delay.valueOf() - b.options.delay.valueOf()),
		);
	},
});
