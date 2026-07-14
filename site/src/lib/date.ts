import { GBP_TIMEZONE } from "@bandori-stats/scheduled/constants";

import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(quarterOfYear);

dayjs.tz.setDefault(GBP_TIMEZONE);

export default dayjs;
