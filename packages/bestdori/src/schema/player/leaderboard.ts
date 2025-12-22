import z from "zod";

export const PlayerLeaderboard = z.strictObject({
	result: z.literal(true),
	count: z.number().nonnegative(),
	rows: z.array(
		z.strictObject({
			user: z.strictObject({
				username: z.string().nonempty(),
				nickname: z.string().nonempty().nullable(),
			}),
			stats: z.number().nonnegative(),
		}),
	),
});
