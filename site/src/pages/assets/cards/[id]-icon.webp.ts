import { openAsBlob } from "node:fs";
import { writeFile } from "node:fs/promises";

import type {
	APIRoute,
	GetStaticPaths,
	InferGetStaticParamsType,
	InferGetStaticPropsType,
} from "astro";

import { uniqBy } from "es-toolkit";

import {
	exists,
	fetchBestdori,
	getCachePath,
} from "@bandori-stats/bestdori/fetch";
import { imageConfig, vips } from "@bandori-stats/bestdori/image";
import { fetchCards } from "@bandori-stats/bestdori/schema/cards";
import { db } from "@bandori-stats/database";

export const prerender = true;

export const GET: APIRoute<Props, Params> = async ({ props }) => {
	const chunkId = Math.floor(Number(props.card.id) / 50)
		.toString()
		.padStart(5, "0");
	const type = props.card.trained ? "after_training" : "normal";
	const imagePath = `/assets/en/thumb/chara/card${chunkId}_rip/${props.card.resourceSetName}_${type}.png`;

	const bytes = await fetchBestdori(imagePath, true)
		.then((response) => response.arrayBuffer())
		.then((buffer) => new Uint8Array(buffer));

	const IMAGE_WIDTH = 96;
	const cachePath = getCachePath(
		`_card_${props.card.id}_${type}.w${IMAGE_WIDTH}.webp`,
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
	const items = await Promise.all([
		db()
			.query.accounts.findMany({
				columns: { profileArt: true },
				where: { profileArt: { isNotNull: true } },
			})
			.then((accounts) => accounts.map(({ profileArt }) => profileArt!)),
		db()
			.query.trackerSnapshotProfiles.findMany({
				columns: { avatar: true, band: true },
			})
			.then((profiles) =>
				profiles
					.flatMap(({ avatar, band }) => [avatar, ...band.members])
					.filter((it) => it !== null),
			),
	]);

	const cards = await fetchCards(import.meta.env.DEV);
	const paths = items.flat().map((it) => {
		let trained = it.trained;
		const card = cards.get(it.id)!;
		if (card.stat.training === undefined) {
			// no trained art
			trained = false;
		} else if (card.stat.training.levelLimit === 0 || card.type === "others") {
			// only trained art available
			trained = true;
		}

		return {
			params: { id: `${it.id}-${it.trained ? "trained" : "normal"}` },
			props: { card: { ...card, id: it.id, trained } },
		};
	});

	return uniqBy(paths.flat(), ({ params }) => params.id);
}) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;
type Params = InferGetStaticParamsType<typeof getStaticPaths>;
