import z from "zod";

export const PlayerProfile = z.object({
	result: z.literal(true),
	posterCard: z
		.object({ id: z.number().positive(), trainedArt: z.boolean() })
		.nullable(),
});
