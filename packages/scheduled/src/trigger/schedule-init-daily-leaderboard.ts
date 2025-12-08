import { schedules, tags } from "@trigger.dev/sdk";
import dayjs from "dayjs";

import { updateLeaderboardByDate } from "./update-leaderboard-by-date";

export const scheduleInitDailyLeaderboard = schedules.task({
	id: "schedule-init-daily-leaderboard",
	cron: "0 0 * * *", // every day
	run: async (context) => {
		const date = dayjs(context.timestamp).format("YYYY-MM-DD");
		await updateLeaderboardByDate.trigger({ date });
		await tags.add("leaderboard_daily");
	},
});
