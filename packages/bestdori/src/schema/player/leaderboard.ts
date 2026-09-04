import z from "zod";

export const PlayerLeaderboard = z.object({
	result: z.literal(true),
	count: z.number().nonnegative(),
	rows: z.array(
		z.object({
			user: z.object({
				username: z.string().nonempty(),
				nickname: z.string().nonempty().nullable(),
			}),
			stats: z.number().nonnegative(),
		}),
	),
});
