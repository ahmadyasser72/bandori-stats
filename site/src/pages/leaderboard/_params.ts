import { STAT_COLUMNS } from "@bandori-stats/database/constants";
import z from "zod";

const schema = {
	page: z.coerce.number().positive().catch(1),
	rank_by: z
		.array(z.enum(STAT_COLUMNS))
		.nonempty()
		.catch(() => [...STAT_COLUMNS]),
	sort_latest: z
		.literal("on")
		.transform((it) => it === "on")
		.catch(false),
};

export const parseSearchParams = (s: URLSearchParams) => ({
	page: schema.page.parse(s.get("page")),
	rank_by: schema.rank_by.parse(s.getAll("rank_by")),
	sort_latest: schema.sort_latest.parse(s.get("sort_latest")),
});
