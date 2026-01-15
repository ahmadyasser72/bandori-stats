import { STAT_NAMES } from "@bandori-stats/bestdori/constants";
import z from "zod";

import { parseDate } from "~/lib/date";

export const schema = {
	rank_by: z.array(z.enum(STAT_NAMES)).transform((items) => ({
		items: items.length === 0 ? STAT_NAMES : items,
		default: items.length === 0,
	})),
	sort_latest: z.stringbool().catch(false),
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
	date: parseDate(s.get("date")),
	rank_by: schema.rank_by.parse(s.getAll("rank_by")),
	sort_latest: schema.sort_latest.parse(s.get("sort_latest")),
	search_username: schema.search_username.parse(s.get("search_username")),
	favorite: schema.favorite.parse(s.getAll("favorite")),
});
