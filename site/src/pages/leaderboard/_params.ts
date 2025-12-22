import { STAT_NAMES } from "@bandori-stats/bestdori/constants";
import z from "zod";

import dayjs from "~/lib/date";

export const schema = {
	date: z.iso.date().catch(dayjs.utc().format("YYYY-MM-DD")),
	page: z.coerce.number().positive().catch(1),
	rank_by: z.array(z.enum(STAT_NAMES)).transform((items) => ({
		items: items.length === 0 ? STAT_NAMES : items,
		default: items.length === 0,
	})),
	sort_latest: z
		.literal("true")
		.transform((it) => it === "true")
		.catch(false),
	search_username: z
		.string()
		.nullable()
		.transform((it) => it?.toLowerCase()),
	favorite: z
		.array(z.string().nonempty())
		.catch(() => [])
		.transform((items) => new Set(items.slice(-5))),
};

export const parseSearchParams = (s: URLSearchParams) => ({
	date: schema.date.parse(s.get("date")),
	page: schema.page.parse(s.get("page")),
	rank_by: schema.rank_by.parse(s.getAll("rank_by")),
	sort_latest: schema.sort_latest.parse(s.get("sort_latest")),
	search_username: schema.search_username.parse(s.get("search_username")),
	favorite: schema.favorite.parse(s.getAll("favorite")),
});
