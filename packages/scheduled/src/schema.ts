import { STAT_COLUMNS } from "@bandori-stats/database/constants";
import z from "zod";

export const StatsSchema = z.strictObject({
	...Object.fromEntries(
		STAT_COLUMNS.map((column) => [column, z.number().nullable()]),
	),
	titles: z.array(z.number().positive()).nonempty().nullable(),
});
