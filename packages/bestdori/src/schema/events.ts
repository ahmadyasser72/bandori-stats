import z from "zod";

export const EventMetadata = z.object({
	attributes: z.array(
		z.object({
			attribute: z.enum(["powerful", "pure", "cool", "happy"]),
			percent: z.number(),
		}),
	),
	characters: z.array(
		z.object({
			characterId: z.number(),
			percent: z.number(),
		}),
	),
	eventAttributeAndCharacterBonus: z.object({
		pointPercent: z.number(),
		parameterPercent: z.number(),
	}),
	eventCharacterParameterBonus: z
		.object({
			performance: z.number(),
			technique: z.number(),
			visual: z.number(),
		})
		.optional(),
	members: z.array(
		z.object({
			situationId: z.number(),
			percent: z.number(),
		}),
	),
	limitBreaks: z.array(
		z.object({
			rarity: z.number(),
			rank: z.number(),
			percent: z.number(),
		}),
	),
});
