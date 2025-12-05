import { STAT_COLUMNS } from "@bandori-stats/database/constants";
import dayjs from "dayjs";
import z from "zod";

export const schema = {
	date: z.iso.date().catch(dayjs().format("YYYY-MM-DD")),
	page: z.coerce.number().positive().catch(1),
	rank_by: z
		.array(z.enum(STAT_COLUMNS))
		.nonempty()
		.catch(() => [...STAT_COLUMNS]),
	sort_latest: z
		.literal("true")
		.transform((it) => it === "true")
		.catch(false),
	search_username: z
		.string()
		.nullable()
		.transform((it) => it?.toLowerCase()),
};

export const parseSearchParams = (s: URLSearchParams) => ({
	date: schema.date.parse(s.get("date")),
	page: schema.page.parse(s.get("page")),
	rank_by: schema.rank_by.parse(s.getAll("rank_by")),
	sort_latest: schema.sort_latest.parse(s.get("sort_latest")),
	search_username: schema.search_username.parse(s.get("search_username")),
});
