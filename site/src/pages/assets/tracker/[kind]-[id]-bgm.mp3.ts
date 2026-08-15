import type {
	APIRoute,
	GetStaticPaths,
	InferGetStaticParamsType,
	InferGetStaticPropsType,
} from "astro";

import { fetchBestdori } from "@bandori-stats/bestdori/fetch";
import { db } from "@bandori-stats/database";

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

export const getStaticPaths = (async () => {
	const events = await db().query.gbpEvents.findMany({
		columns: { eventId: true, bgmAssetBundleName: true, bgmFileName: true },
	});
	const monthlies = await db().query.gbpMonthlyRankings.findMany({
		columns: {
			monthlyRankingId: true,
			bgmAssetBundleName: true,
			bgmFileName: true,
		},
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
