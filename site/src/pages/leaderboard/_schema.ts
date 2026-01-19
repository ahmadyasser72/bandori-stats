import { STAT_NAMES } from "@bandori-stats/bestdori/constants";

import z from "zod";

import { alwaysArray, dateSchema } from "~/lib/schema";

export const schema = z.object({
	date: dateSchema,
	rank_by: z
		.enum(STAT_NAMES)
		.apply(alwaysArray)
		.catch(() => [])
		.transform((items) => ({
			items: new Set(items.length === 0 ? STAT_NAMES : items),
			isDefault: items.length === 0,
		})),
	sort_latest: z.stringbool().catch(false),
	search_username: z
		.string()
		.optional()
		.transform((it) => it?.toLowerCase()),
	favorite: z
		.string()
		.apply(alwaysArray)
		.catch(() => [])
		.transform((it) => new Set(it.slice(-5))),
});
