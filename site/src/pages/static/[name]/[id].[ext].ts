import { openAsBlob } from "node:fs";
import { writeFile } from "node:fs/promises";
import {
	exists,
	fetchBestdori,
	getCachePath,
} from "@bandori-stats/bestdori/fetch";
import { imageConfig, vips } from "@bandori-stats/bestdori/image";

import type {
	APIRoute,
	GetStaticPaths,
	InferGetStaticParamsType,
	InferGetStaticPropsType,
} from "astro";

export const prerender = true;

export const GET: APIRoute<Props, Params> = async ({ params, props }) => {
	const response = await fetchBestdori(props.path, true);

	if (params.ext === "svg") {
		const svg = await response.text();

		try {
			const { optimise } = await import("@oxvg/napi");
			return new Response(optimise(svg), {
				headers: { "content-type": "image/svg+xml" },
			});
		} catch (error) {
			console.error("failed to optimize svg", { error, params });
			return new Response(svg, {
				headers: { "content-type": "image/svg+xml" },
			});
		}
	}

	const bytes = await response
		.arrayBuffer()
		.then((buffer) => new Uint8Array(buffer));
	const cachePath = getCachePath(`_${params.name}_${params.id}.webp`);
	const cacheExists = await exists(cachePath);
	if (cacheExists) {
		const blob = await openAsBlob(cachePath);
		return new Response(blob);
	}

	const image = vips.Image.newFromBuffer(bytes);
	const out = image.webpsaveBuffer(imageConfig);
	await writeFile(cachePath, out);

	image.delete();

	return new Response(out as Uint8Array<ArrayBuffer>);
};

export const getStaticPaths = (() => {
	const attributes = ["powerful", "cool", "pure", "happy"];
	const bands = [1, 2, 3, 4, 5, 18, 21, 45];
	const characters = Array.from({ length: 40 }, (_, idx) => idx + 1);

	return [
		...attributes.map((id) => ({
			params: { name: "attributes", id, ext: "svg" as const },
			props: { path: `/res/icon/${id}.svg` },
		})),
		...bands.map((id) => ({
			params: { name: "bands", id: id.toString(), ext: "svg" as const },
			props: { path: `/res/icon/band_${id}.svg` },
		})),
		...characters.map((id) => ({
			params: { name: "characters", id: id.toString(), ext: "webp" as const },
			props: { path: `/res/icon/chara_icon_${id}.png` },
		})),
	];
}) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;
type Params = InferGetStaticParamsType<typeof getStaticPaths>;
