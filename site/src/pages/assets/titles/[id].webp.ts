import { openAsBlob } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

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
import { unwrapRegionTuple } from "@bandori-stats/bestdori/helpers";
import { imageConfig, vips } from "@bandori-stats/bestdori/image";
import {
	BestdoriDegree,
	fetchDegrees,
} from "@bandori-stats/bestdori/schema/degree";
import { db } from "@bandori-stats/database";
import { PLAYER_TITLES_SET, redis } from "@bandori-stats/database/redis";

export const prerender = true;

const IMAGE_WIDTH = 180;

export const GET: APIRoute<Props, Params> = async ({ props }) => {
	let animated: string | undefined;
	if (props.images.length === 1 && props.images[0].includes("/ani_degree_")) {
		const baseImageName = props.images[0]
			.split("/")
			.at(-1)!
			.replace(".png", "");
		props.images[0] = `/assets/en/${baseImageName}_rip/assets-star-forassetbundle-startapp-thumbnail-animedegree-${baseImageName}-${baseImageName}.png`;
		animated = baseImageName;
	}

	const imageBytes = await Promise.all(
		props.images.map((path) =>
			fetchBestdori(path, true)
				.then((response) => response.arrayBuffer())
				.then((buffer) => new Uint8Array(buffer)),
		),
	);

	if (imageBytes.length === 1 && !animated) return new Response(imageBytes[0]);

	const basenames = props.images
		.map((it) => path.basename(it).replace(".png", ""))
		.join("+");
	const cachePath = getCachePath(`_title_${basenames}.w${IMAGE_WIDTH}.webp`);
	const cacheExists = await exists(cachePath);
	if (cacheExists) {
		const blob = await openAsBlob(cachePath);
		return new Response(blob);
	}

	if (imageBytes.length === 1 && animated)
		return animatedFromSpriteSheet(imageBytes[0], animated, cachePath);

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

const animatedFromSpriteSheet = async (
	buffer: Uint8Array,
	name: string,
	cachePath: string,
) => {
	const sheet = vips.Image.newFromBuffer(buffer);
	const { trimmed, cols, rows, width, height } = (() => {
		const trim = sheet.findTrim();

		if (name === "ani_degree_election_5th") {
			const SHEET_WIDTH = 925;
			const SHEET_HEIGHT = 765;
			const trimmed = sheet.crop(
				trim.left,
				trim.top - 1,
				SHEET_WIDTH,
				SHEET_HEIGHT,
			);

			const width = SHEET_WIDTH / 4;
			const height = SHEET_HEIGHT / 15;
			const cols = Math.floor(trimmed.width / width);
			const rows = Math.floor(trimmed.height / height);
			return { trimmed, cols, rows, width, height };
		}

		const trimmed = sheet.crop(trim.left, trim.top, trim.width, trim.height);
		const width = 230;
		const height = 50;
		const cols = Math.floor(trimmed.width / width);
		const rows = Math.floor(trimmed.height / height);
		return { trimmed, cols, rows, width, height };
	})();

	const frames = [];
	for (let col = cols - 1; col >= 0; col -= 1) {
		for (let row = rows - 1; row >= 0; row -= 1) {
			const left = col * width;
			const top = row * height;

			const frame = trimmed.extractArea(left, top, width, height);

			if (frame.avg() > 100) frames.push(frame);
			else frame.delete();
		}
	}

	const joined = vips.Image.arrayjoin(frames, { across: 1 });
	joined.setInt("page-height", height);
	joined.setArrayInt("delay", Array(frames.length).fill(100));

	const small = joined.thumbnailImage(IMAGE_WIDTH);
	const out = small.webpsaveBuffer(imageConfig);
	await writeFile(cachePath, out);

	small.delete();
	joined.delete();
	for (const frame of frames) frame.delete();
	trimmed.delete();
	sheet.delete();

	return new Response(out as Uint8Array<ArrayBuffer>);
};

const buildDegreeImages = (degree: BestdoriDegree) => {
	const basePath = "/assets/en/thumb/degree_rip";

	const baseImageName = unwrapRegionTuple(degree.baseImageName);
	const rank = unwrapRegionTuple(degree.rank);
	const degreeType = unwrapRegionTuple(degree.degreeType);
	const iconImageName = unwrapRegionTuple(degree.iconImageName);

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
	const titles = new Set(
		(
			await Promise.all([
				redis().smembers<number[]>(PLAYER_TITLES_SET),
				db()
					.query.trackerSnapshotProfiles.findMany({ columns: { titles: true } })
					.then((profiles) => profiles.flatMap(({ titles }) => titles)),
			])
		).flat(),
	);
	degrees.forEach((degree, id) => {
		if (!titles.has(id)) return;

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
