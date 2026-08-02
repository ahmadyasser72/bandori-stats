import { openAsBlob } from "node:fs";
import { writeFile } from "node:fs/promises";
import {
	exists,
	fetchBestdori,
	getCachePath,
} from "@bandori-stats/bestdori/fetch";
import { uniqBy } from "@bandori-stats/bestdori/helpers";
import { imageConfig, vips } from "@bandori-stats/bestdori/image";
import { fetchCards } from "@bandori-stats/bestdori/schema/cards";
import { GAME_SERVER, SERVER_PATHS } from "@bandori-stats/bestdori/server";
import { db } from "@bandori-stats/database";

import type {
	APIRoute,
	GetStaticPaths,
	InferGetStaticParamsType,
	InferGetStaticPropsType,
} from "astro";

export const prerender = true;

export const GET: APIRoute<Props, Params> = async ({ props }) => {
	const chunkId = Math.floor(Number(props.card.id) / 50)
		.toString()
		.padStart(5, "0");
	const type = props.card.trained ? "after_training" : "normal";
	const imagePath = `/assets/${SERVER_PATHS[GAME_SERVER]}/thumb/chara/card${chunkId}_rip/${props.card.resourceSetName}_${type}.png`;

	const bytes = await fetchBestdori(imagePath, true)
		.then((response) => response.arrayBuffer())
		.then((buffer) => new Uint8Array(buffer));

	const IMAGE_WIDTH = 64;
	const cachePath = getCachePath(
		`_card_${SERVER_PATHS[GAME_SERVER]}_${props.card.id}_${type}.w${IMAGE_WIDTH}.webp`,
	);
	const cacheExists = await exists(cachePath);
	if (cacheExists) {
		const blob = await openAsBlob(cachePath);
		return new Response(blob);
	}

	const image = vips.Image.newFromBuffer(bytes);
	const small = image.thumbnailImage(IMAGE_WIDTH);
	const out = small.webpsaveBuffer(imageConfig);
	await writeFile(cachePath, out);

	image.delete();
	small.delete();

	return new Response(out as Uint8Array<ArrayBuffer>);
};

export const getStaticPaths = (async () => {
	const cards = await fetchCards(import.meta.env.DEV);
	const accounts = await db().query.accounts.findMany({
		columns: { profileArt: true },
		where: { profileArt: { isNotNull: true } },
	});

	const paths = accounts.map(({ profileArt }) => {
		let trained = profileArt!.trained;
		const card = cards.get(profileArt!.id)!;
		if (card.stat.training === undefined) {
			// no trained art
			trained = false;
		} else if (card.stat.training.levelLimit === 0 || card.type === "others") {
			// only trained art available
			trained = true;
		}

		return {
			params: {
				id: `${profileArt!.id}-${profileArt!.trained ? "trained" : "normal"}`,
			},
			props: { card: { ...card, ...profileArt!, trained } },
		};
	});

	return uniqBy(paths, ({ params }) => params.id);
}) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;
type Params = InferGetStaticParamsType<typeof getStaticPaths>;
