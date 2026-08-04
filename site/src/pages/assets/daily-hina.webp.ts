import { openAsBlob } from "node:fs";
import { writeFile } from "node:fs/promises";

import type { APIRoute } from "astro";

import { dailyHina } from "virtual:daily-hina";

import {
	exists,
	fetchBestdori,
	getCachePath,
} from "@bandori-stats/bestdori/fetch";
import { imageConfig, vips } from "@bandori-stats/bestdori/image";

export const prerender = true;

export const GET: APIRoute = async () => {
	const { id, resourceSetName, trained } = dailyHina;
	const type = trained ? "after_training" : "normal";
	const imagePath = `/assets/en/characters/resourceset/${resourceSetName}_rip/card_${type}.png`;

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
