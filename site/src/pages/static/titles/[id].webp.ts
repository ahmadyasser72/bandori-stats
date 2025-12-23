import type {
	APIRoute,
	GetStaticPaths,
	InferGetStaticParamsType,
	InferGetStaticPropsType,
} from "astro";

import {
	BestdoriDegree,
	fetchDegrees,
} from "@bandori-stats/bestdori/schema/degree";
import { redis } from "@bandori-stats/database/redis";

import { fetchBestdori } from "~/lib/bestdori";

export const prerender = true;

export const GET: APIRoute<Props, Params> = async ({ props }) => {
	const [baseImage, ...layers] = await Promise.all(
		props.images.map((path) =>
			fetchBestdori(path)
				.then((response) => response.arrayBuffer())
				.then(Buffer.from),
		),
	);

	if (layers.length === 0) return new Response(baseImage);

	const { default: sharp } = await import("sharp");
	const image = await sharp(baseImage)
		.composite(layers.map((buffer) => ({ input: buffer, left: 0, top: 0 })))
		.webp()
		.toBuffer();

	return new Response(Buffer.from(image));
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
	const degrees = await fetchDegrees();

	const imageEntries = [] as [number, string[]][];
	const titles = await redis.smembers<number[]>("leaderboard:titles");
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
