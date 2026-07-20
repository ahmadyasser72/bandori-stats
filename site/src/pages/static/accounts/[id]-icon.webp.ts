import { fetchBestdori } from "@bandori-stats/bestdori/fetch";
import { fetchCards } from "@bandori-stats/bestdori/schema/cards";
import { db } from "@bandori-stats/database";

import type {
	APIRoute,
	GetStaticPaths,
	InferGetStaticParamsType,
	InferGetStaticPropsType,
} from "astro";

export const prerender = true;

export const GET: APIRoute<Props, Params> = async ({ props: { card } }) => {
	const chunkId = Math.floor(Number(card.id) / 50)
		.toString()
		.padStart(5, "0");
	const image = await fetchBestdori(
		`/assets/en/thumb/chara/card${chunkId}_rip/${card.resourceSetName}_${card.trained ? "after_training" : "normal"}.png`,
		true,
	)
		.then((response) => response.arrayBuffer())
		.then(Buffer.from);

	const { default: sharp } = await import("sharp");
	return sharp(image)
		.webp({ quality: 67 })
		.toBuffer()
		.then((buffer) => new Response(Buffer.from(buffer)));
};

export const getStaticPaths = (async () => {
	const cards = await fetchCards(import.meta.env.DEV);
	const accounts = await db.query.accounts.findMany({
		columns: { id: true, profileArt: true },
		where: { profileArt: { isNotNull: true } },
	});

	return accounts.map(({ id, profileArt }) => {
		const card = cards.get(profileArt!.id)!;

		let trained = profileArt!.trained;
		if (card.stat.training === undefined) {
			// no trained art
			trained = false;
		} else if (card.stat.training.levelLimit === 0 || card.type === "others") {
			// only trained art available
			trained = true;
		}

		return {
			params: { id: id.toString() },
			props: { card: { ...card, ...profileArt!, trained } },
		};
	});
}) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;
type Params = InferGetStaticParamsType<typeof getStaticPaths>;
