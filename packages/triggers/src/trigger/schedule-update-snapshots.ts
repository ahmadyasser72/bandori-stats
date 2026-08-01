import { GBP_TIMEZONE } from "@bandori-stats/bestdori/constants";
import dayjs from "@bandori-stats/bestdori/date";
import { db } from "@bandori-stats/database";

import { schedules, type BatchItem } from "@trigger.dev/sdk";
import { Random } from "random";

import { updateProfile } from "./update-profile";
import { updateStats } from "./update-stats";

export const scheduleUpdateSnapshots = schedules.task({
	id: "schedule-update-snapshots",
	cron: {
		pattern: "5 0 * * *",
		timezone: GBP_TIMEZONE,
	},
	run: async (context) => {
		const now = dayjs.tz(context.timestamp, GBP_TIMEZONE);
		const date = now.startOf("day").format("YYYY-MM-DD");

		const rng = new Random(now.unix());
		const accounts = await db()
			.query.accounts.findMany({
				columns: { id: true, username: true, lastUpdated: true },
				where: { disabledAt: { isNull: true } },
			})
			.then((accounts) =>
				rng
					.shuffle(accounts)
					.map((account, idx) => ({ ...account, idx }))
					.filter((account) => {
						if (account.lastUpdated === null) return true;

						const lastUpdated = dayjs(account.lastUpdated);
						const isRecentlyUpdated = now.diff(lastUpdated, "weeks") < 2;
						if (isRecentlyUpdated) return true;

						let delayUpdateDays = 7;
						const monthsSinceUpdate = now.diff(lastUpdated, "months");
						if (monthsSinceUpdate >= 6) delayUpdateDays = 28;
						else if (monthsSinceUpdate >= 3) delayUpdateDays = 14;

						const jitter = account.id % delayUpdateDays;
						const daysSinceUpdate = now.diff(lastUpdated, "days");
						return (
							daysSinceUpdate > jitter &&
							daysSinceUpdate % delayUpdateDays === jitter
						);
					}),
			);

		const TOTAL_MINUTES = 24 * 60 - 10;
		const slot = TOTAL_MINUTES / accounts.length;
		type Payload = BatchItem<{ username: string; date: string }>;
		const payloads = accounts.map(
			({ username, idx }) =>
				Array.from({ length: 2 }, (): Payload => ({
					payload: { username, date },
					options: {
						delay: now
							.add(rng.float(idx * slot, (idx + 1) * slot), "minutes")
							.toDate(),
						tags: `@_${username}`,
					},
				})) as [Payload, Payload],
		);

		const maxBatchSize = 1000;
		for (let idx = 0; idx < payloads.length; idx += maxBatchSize) {
			const chunk = payloads.slice(idx, idx + maxBatchSize);
			await updateStats.batchTrigger(chunk.map(([payload]) => payload));
			await updateProfile.batchTrigger(chunk.map(([, payload]) => payload));
		}
	},
});
