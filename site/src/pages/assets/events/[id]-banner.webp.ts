import { openAsBlob } from "node:fs";
import { writeFile } from "node:fs/promises";
import {
	exists,
	fetchBestdori,
	getCachePath,
} from "@bandori-stats/bestdori/fetch";
import { imageConfig, vips } from "@bandori-stats/bestdori/image";
import { GAME_SERVER, SERVER_PATHS } from "@bandori-stats/bestdori/server";

import type {
	APIRoute,
	GetStaticPaths,
	InferGetStaticParamsType,
	InferGetStaticPropsType,
} from "astro";
import { leaderboards } from "virtual:bandori-leaderboard";

export const prerender = true;

export const GET: APIRoute<Props, Params> = async ({ params, props }) => {
	const imagePath = `/assets/${SERVER_PATHS[GAME_SERVER]}/homebanner_rip/${props.event.bannerAssetBundleName}.png`;
	const bytes = await fetchBestdori(imagePath, true)
		.then((response) => response.arrayBuffer())
		.then((buffer) => new Uint8Array(buffer));

	const IMAGE_WIDTH = 400;
	const cachePath = getCachePath(
		`_event_${params.id}_banner.w${IMAGE_WIDTH}.webp`,
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
	const events = Object.values(leaderboards.events);

	return events.map(({ id, bannerAssetBundleName }) => ({
		params: { id: id.toString() },
		props: { event: { bannerAssetBundleName } },
	}));
}) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;
type Params = InferGetStaticParamsType<typeof getStaticPaths>;
