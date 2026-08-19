import z from "zod";

import { RegionTuple } from "./misc";

// /api/skills/all.10.json
export const Skills = z
	.record(
		z.string(),
		z.object({
			duration: z.array(z.number().positive()),
			description: RegionTuple(z.string()),
			onceEffect: z
				.object({ onceEffectValue: z.array(z.number().positive()) })
				.optional(),
		}),
	)
	.transform((skills) => {
		const entries = Object.entries(skills).map(
			([id, entry]) => [Number(id), entry] as const,
		);

		return new Map(entries);
	});
