import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import z from "zod";

dayjs.extend(utc);

export default dayjs;

const DateSchema = z.iso.date().catch(dayjs.utc().format("YYYY-MM-DD"));
export const parseDate = DateSchema.parse;
