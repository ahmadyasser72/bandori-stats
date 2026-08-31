import type { APIRoute } from "astro";

import { fetchBestdori } from "@bandori-stats/bestdori/fetch";
import type { Params, Props } from "./_data";

export const prerender = true;

export const GET: APIRoute<Props, Params> = async ({ props }) => {
	let bgmPath: string;
	const { bgmAssetBundleName, bgmFileName } = props;
	if (bgmFileName.startsWith("bgm") && bgmFileName.endsWith("_chorus")) {
		const chunkId = 10 * Math.ceil(Number(bgmFileName.match(/\d+/)![0]) / 10);
		bgmPath = `/assets/en/musicscore/musicscore${chunkId}_rip/${bgmFileName}.mp3`;
	} else {
		bgmPath = `/assets/en/${bgmAssetBundleName}_rip/${bgmFileName}.mp3`;
	}

	return fetchBestdori(bgmPath, true);
};
export { getStaticPaths } from "./_data";
