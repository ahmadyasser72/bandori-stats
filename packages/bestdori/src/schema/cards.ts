import z from "zod";

import { fetchBestdori } from "../fetch";

const AllCards = z
	.record(
		z.string(),
		z.object({
			resourceSetName: z.string(),
			type: z.string(),
			stat: z.object({
				training: z.object({ levelLimit: z.number().nonnegative() }).optional(),
			}),
		}),
	)
	.transform(
		(record) => new Map(Object.entries(record).map(([k, v]) => [Number(k), v])),
	);
export const fetchCards = (cache: boolean = true) =>
	fetchBestdori("/api/cards/all.5.json", cache)
		.then((response) => response.json())
		.then(AllCards.parse);
