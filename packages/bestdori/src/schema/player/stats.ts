import z from "zod";

import { RAW_STAT_NAMES } from "../../constants";

export const PlayerStats = z.strictObject({
	result: z.literal(true),
	accounts: z.array(
		z.strictObject({
			server: z.number().nonnegative(),
			titles: z.array(z.number().positive()).nonempty().optional(),
			...Object.fromEntries(
				[...RAW_STAT_NAMES, "uid" as const].map((key) => [
					key,
					z.number().nonnegative().optional(),
				]),
			),
		}),
	),
});
