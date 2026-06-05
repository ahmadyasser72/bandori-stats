import { REGIONS } from "@bandori-stats/bestdori/constants";
import {
	BestdoriDegree,
	fetchDegrees,
} from "@bandori-stats/bestdori/schema/degree";
import { getPlayerTitlesSet, redis } from "@bandori-stats/database/redis";

import type {
	APIRoute,
	GetStaticPaths,
	InferGetStaticParamsType,
	InferGetStaticPropsType,
} from "astro";

import { fetchBestdori } from "~/lib/bestdori";

export const prerender = true;

export const GET: APIRoute<Props, Params> = async ({ params }) => {
	const { region, id } = params;
	const idNum = Number(id);
	
	const degrees = await fetchDegrees();
	const degree = degrees.get(idNum);
	if (!degree) return new Response("Not found", { status: 404 });

	const images = buildDegreeImages(degree, region as any);
	if (images.length === 0)
		return new Response("Images unavailable", { status: 404 });

	const [baseImage, ...layers] = await Promise.all(
		images.map((path) =>
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

const pickRegion = <T>(tuple: T[], regionIndex: number) => tuple.at(regionIndex) ?? tuple.at(0)!;

const buildDegreeImages = (degree: BestdoriDegree, region: string) => {
	const regionIndex = REGIONS.indexOf(region as any);
	const basePath = `/assets/${region.toLowerCase()}/thumb/degree_rip`;

	const baseImageName = pickRegion(degree.baseImageName, regionIndex);
	const rank = pickRegion(degree.rank, regionIndex);
	const degreeType = pickRegion(degree.degreeType, regionIndex);
	const iconImageName = pickRegion(degree.iconImageName, regionIndex);

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

	const paths = [] as { params: { region: string; id: string }; props: Record<string, never> }[];
	
	// Generate paths for all regions
	for (const region of REGIONS) {
		const titlesKey = getPlayerTitlesSet(region);
		const titles = await redis.smembers<number[]>(titlesKey);
		
		degrees.forEach((degree, id) => {
			if (!titles.includes(id)) return;

			const degreeImages = buildDegreeImages(degree, region);
			if (degreeImages.length === 0)
				throw new Error(`images unavailable for degree #${id}`);

			paths.push({
				params: { region, id: id.toString() },
				props: {},
			});
		});
	}

	return paths;
}) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;
type Params = InferGetStaticParamsType<typeof getStaticPaths>;
