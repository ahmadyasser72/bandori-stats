import { openAsBlob } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
	exists,
	fetchBestdori,
	getCachePath,
} from "@bandori-stats/bestdori/fetch";
import { imageConfig, vips } from "@bandori-stats/bestdori/image";
import {
	BestdoriDegree,
	fetchDegrees,
} from "@bandori-stats/bestdori/schema/degree";
import { PLAYER_TITLES_SET, redis } from "@bandori-stats/database/redis";

import type {
	APIRoute,
	GetStaticPaths,
	InferGetStaticParamsType,
	InferGetStaticPropsType,
} from "astro";

export const prerender = true;

export const GET: APIRoute<Props, Params> = async ({ props }) => {
	const imageBytes = await Promise.all(
		props.images.map((path) =>
			fetchBestdori(path, true)
				.then((response) => response.arrayBuffer())
				.then((buffer) => new Uint8Array(buffer)),
		),
	);

	if (imageBytes.length === 1) return new Response(imageBytes[0]);

	const IMAGE_WIDTH = 150;
	const basenames = props.images
		.map((it) => path.basename(it).replace(".png", ""))
		.join("+");
	const cachePath = getCachePath(`_title_${basenames}.w${IMAGE_WIDTH}.webp`);
	const cacheExists = await exists(cachePath);
	if (cacheExists) {
		const blob = await openAsBlob(cachePath);
		return new Response(blob);
	}

	const images = imageBytes.map((bytes) => vips.Image.newFromBuffer(bytes));
	const combined = vips.Image.composite(images, vips.BlendMode.over);
	const small = combined.thumbnailImage(IMAGE_WIDTH);
	const out = small.webpsaveBuffer(imageConfig);
	await writeFile(cachePath, out);

	small.delete();
	combined.delete();
	for (const image of images) image.delete();

	return new Response(out as Uint8Array<ArrayBuffer>);
};

const pickRegion = <T>(tuple: T[]) => tuple.at(1) ?? tuple.at(0)!;

const buildDegreeImages = (degree: BestdoriDegree) => {
	const basePath = "/assets/en/thumb/degree_rip";

	const baseImageName = pickRegion(degree.baseImageName);
	const rank = pickRegion(degree.rank);
	const degreeType = pickRegion(degree.degreeType);
	const iconImageName = pickRegion(degree.iconImageName);

	const images = [`${basePath}/${baseImageName}.png`];
	if (rank !== null && rank !== "none") {
		images.push(`${basePath}/${degreeType}_${rank}.png`);

		if (iconImageName !== null && iconImageName !== "none") {
			images.push(`${basePath}/${iconImageName}_${rank}.png`);
		}
	}

	return images;
};

export const getStaticPaths = (async () => {
	const degrees = await fetchDegrees(import.meta.env.DEV);

	const imageEntries = [] as [number, string[]][];
	const titles = await redis().smembers<number[]>(PLAYER_TITLES_SET);
	degrees.forEach((degree, id) => {
		if (!titles.includes(id)) return;

		const degreeImages = buildDegreeImages(degree);
		if (degreeImages.length === 0)
			throw new Error(`images unavailable for degree #${id}`);

		imageEntries.push([id, degreeImages]);
	});

	return imageEntries.map(([id, images]) => ({
		params: { id: id.toString() },
		props: { images },
	}));
}) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;
type Params = InferGetStaticParamsType<typeof getStaticPaths>;
