import type {
	APIRoute,
	GetStaticPaths,
	InferGetStaticParamsType,
	InferGetStaticPropsType,
} from "astro";

import { favicons } from "favicons";
import { dailyHina } from "virtual:daily-hina";

import { fetchBestdori } from "@bandori-stats/bestdori/fetch";

export const prerender = true;

export const GET: APIRoute<Props, Params> = ({ props }) =>
	new Response(props.contents as Buffer<ArrayBuffer>);

export const getStaticPaths = (async () => {
	const { id, resourceSetName, trained } = dailyHina;

	const chunkId = Math.floor(Number(id) / 50)
		.toString()
		.padStart(5, "0");
	const type = trained ? "after_training" : "normal";
	const imagePath = `/assets/en/thumb/chara/card${chunkId}_rip/${resourceSetName}_${type}.png`;

	const buffer = await fetchBestdori(imagePath, true)
		.then((response) => response.arrayBuffer())
		.then(Buffer.from);

	const response = await favicons(buffer, {
		path: "/favicon",
		icons: {
			appleIcon: false,
			android: false,
			appleStartup: false,
			yandex: false,
			windows: false,
		},
	});

	return response.images.map(({ name, contents }) => ({
		params: { name: name.replace(/^favicon/, "") },
		props: { contents },
	}));
}) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;
type Params = InferGetStaticParamsType<typeof getStaticPaths>;
