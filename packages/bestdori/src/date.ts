import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import { GBP_TIMEZONE } from "./constants";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(quarterOfYear);
dayjs.extend(isBetween);

dayjs.tz.setDefault(GBP_TIMEZONE);

export default dayjs;

interface FormatDurationParams {
	from?: dayjs.ConfigType;
	to?: dayjs.ConfigType;
}

export const formatDuration = (config: FormatDurationParams) => {
	const from = dayjs(config.from);
	const to = dayjs(config.to);

	const totalMinutes = Math.abs(to.diff(from, "minutes"));
	if (totalMinutes < 1) return "just now";

	const days = Math.floor(totalMinutes / (60 * 24));
	const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
	const minutes = totalMinutes % 60;

	const parts: string[] = [];
	if (to.isBefore(from)) parts.push("in");
	if (days) parts.push(`${days}d`);
	if (hours) parts.push(`${hours}h`);
	if (minutes) parts.push(`${minutes}m`);
	if (from.isBefore(to)) parts.push("ago");

	return parts.join(" ");
};
