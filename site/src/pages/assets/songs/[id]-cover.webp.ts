import { openAsBlob } from "node:fs";
import { writeFile } from "node:fs/promises";

import type {
	APIRoute,
	GetStaticPaths,
	InferGetStaticParamsType,
	InferGetStaticPropsType,
} from "astro";

import {
	exists,
	fetchBestdori,
	getCachePath,
} from "@bandori-stats/bestdori/fetch";
import { imageConfig, vips } from "@bandori-stats/bestdori/image";
import { db } from "@bandori-stats/database";

export const prerender = true;

export const GET: APIRoute<Props, Params> = async ({ params, props }) => {
	const chunk = 10 * Math.ceil(props.song.id / 10);
	const imagePath = `/assets/en/musicjacket/musicjacket${chunk}_rip/assets-star-forassetbundle-startapp-musicjacket-musicjacket${chunk}-${props.song.jacketImage.toLowerCase()}-jacket.png`;
	const bytes = await fetchBestdori(imagePath, true)
		.then((response) => response.arrayBuffer())
		.then((buffer) => new Uint8Array(buffer));

	const IMAGE_WIDTH = 320;
	const cachePath = getCachePath(
		`_song_${params.id}_cover.w${IMAGE_WIDTH}.webp`,
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
	const songs = await db().query.gbpEventMusics.findMany({
		columns: { id: true, jacketImage: true },
	});

	return songs.map(({ id, jacketImage }) => ({
		params: { id: id.toString() },
		props: { song: { id, jacketImage } },
	}));
}) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;
type Params = InferGetStaticParamsType<typeof getStaticPaths>;
