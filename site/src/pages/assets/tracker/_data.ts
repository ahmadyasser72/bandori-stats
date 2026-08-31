import type {
	GetStaticPaths,
	InferGetStaticParamsType,
	InferGetStaticPropsType,
} from "astro";

import { allKeyed, once } from "es-toolkit";

import { db } from "@bandori-stats/database";

const getMetadatas = once(() => {
	const columns = {
		id: true,
		assetBundleName: true,
		bgmAssetBundleName: true,
		bgmFileName: true,
	} as const;

	return allKeyed({
		events: db().query.gbpEvents.findMany({ columns }),
		monthlies: db().query.gbpMonthlyRankings.findMany({ columns }),
	});
});

export const getStaticPaths = (async () => {
	const { events, monthlies } = await getMetadatas();

	return [
		...events.map(({ id, ...event }) => ({
			params: { kind: "event", id: id.toString() },
			props: { id, ...event },
		})),
		...monthlies.map(({ id, ...monthly }) => ({
			params: { kind: "monthly", id: id.toString() },
			props: { id, ...monthly },
		})),
	];
}) satisfies GetStaticPaths;

export type Props = InferGetStaticPropsType<typeof getStaticPaths>;
export type Params = InferGetStaticParamsType<typeof getStaticPaths>;
