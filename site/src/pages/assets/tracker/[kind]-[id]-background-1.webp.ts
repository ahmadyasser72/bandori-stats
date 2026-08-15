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
	const imagePath = `/assets/en/event/${props.assetBundleName}/topscreen_rip/trim_eventtop.png`;
	const bytes = await fetchBestdori(imagePath, true)
		.then((response) => response.arrayBuffer())
		.then((buffer) => new Uint8Array(buffer));

	const IMAGE_WIDTH = 640;
	const cachePath = getCachePath(
		`_tracker_${params.kind}_${params.id}_background-1.w${IMAGE_WIDTH}.webp`,
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
	const events = await db().query.gbpEvents.findMany({
		columns: { eventId: true, assetBundleName: true },
	});
	const monthlies = await db().query.gbpMonthlyRankings.findMany({
		columns: { monthlyRankingId: true, assetBundleName: true },
	});

	return [
		...events.map(({ eventId, ...rest }) => ({
			params: { kind: "event", id: eventId.toString() },
			props: { id: eventId, ...rest },
		})),
		...monthlies.map(({ monthlyRankingId, ...rest }) => ({
			params: { kind: "monthly", id: monthlyRankingId.toString() },
			props: { id: monthlyRankingId, ...rest },
		})),
	];
}) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;
type Params = InferGetStaticParamsType<typeof getStaticPaths>;
