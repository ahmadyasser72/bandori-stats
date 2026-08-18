import z from "zod";

import { fetchBestdori } from "../fetch";

export const Card = z.object({
	characterId: z.coerce.number(),
	rarity: z.number().min(1).max(5),
	attribute: z.enum(["powerful", "pure", "cool", "happy"]),
	resourceSetName: z.string(),
	type: z.string(),
	stat: z
		.object({
			training: z.object({ levelLimit: z.number().nonnegative() }).optional(),
		})
		.and(
			z.looseRecord(
				z.number().min(1).max(60),
				z
					.record(
						z.enum(["performance", "technique", "visual"]),
						z.coerce.number().positive(),
					)
					.optional(),
			),
		),
});

const AllCards = z
	.record(z.string(), Card)
	.transform(
		(record) => new Map(Object.entries(record).map(([k, v]) => [Number(k), v])),
	);
export const fetchCards = (cache: boolean = true) =>
	fetchBestdori("/api/cards/all.5.json", cache)
		.then((response) => response.json())
		.then(AllCards.parse);
