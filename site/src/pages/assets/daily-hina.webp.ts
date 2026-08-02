import { openAsBlob } from "node:fs";
import { writeFile } from "node:fs/promises";
import dayjs from "@bandori-stats/bestdori/date";
import {
	exists,
	fetchBestdori,
	getCachePath,
} from "@bandori-stats/bestdori/fetch";
import { imageConfig, vips } from "@bandori-stats/bestdori/image";
import { fetchCards } from "@bandori-stats/bestdori/schema/cards";
import { GAME_SERVER, SERVER_PATHS } from "@bandori-stats/bestdori/server";

import type { APIRoute } from "astro";
import { Random } from "random";

export const prerender = true;

export const GET: APIRoute = async () => {
	const cards = await fetchCards(import.meta.env.DEV);
	const hinaCards = [...cards.entries()].filter(
		([, { characterId, rarity, type }]) =>
			characterId === 17 && (rarity === 5 || type === "limited"),
	);

	const rng = new Random(dayjs.tz().startOf("days").unix());
	const [id, card] = rng.choice(hinaCards)!;
	let trained = rng.boolean();
	if (card.stat.training === undefined) {
		// no trained art
		trained = false;
	} else if (card.stat.training.levelLimit === 0 || card.type === "others") {
		// only trained art available
		trained = true;
	}

	const type = trained ? "after_training" : "normal";
	const imagePath = `/assets/${SERVER_PATHS[GAME_SERVER]}/characters/resourceset/${card.resourceSetName}_rip/card_${type}.png`;

	const bytes = await fetchBestdori(imagePath, true)
		.then((response) => response.arrayBuffer())
		.then((buffer) => new Uint8Array(buffer));

	const IMAGE_WIDTH = 640;
	const cachePath = getCachePath(
		`_card_full_${id}_${type}.w${IMAGE_WIDTH}.webp`,
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
