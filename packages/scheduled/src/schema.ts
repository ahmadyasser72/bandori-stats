import { STAT_NAMES } from "@bandori-stats/bestdori/constants";

import z from "zod";

export const StatsSchema = z.strictObject({
	uid: z.string().nullable(),
	stats: z.strictObject({
		...Object.fromEntries(
			STAT_NAMES.map((name) => [name, z.number().nullable()]),
		),
		titles: z.array(z.number().positive()).nullable(),
	}),
});
