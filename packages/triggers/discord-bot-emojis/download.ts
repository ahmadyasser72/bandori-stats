import { bestdori } from "~/bestdori";

const save = async <T>(
	ids: T[],
	path: (id: T) => string,
	output: (id: T) => string,
) =>
	Promise.all(
		ids.map(async (id) => {
			const file = Bun.file(output(id));
			if (await file.exists()) return;

			const response = await bestdori({ path: path(id), schema: false });
			const buffer = await response.arrayBuffer();
			await file.write(buffer);
		}),
	);

await Promise.all([
	save(
		["powerful", "cool", "pure", "happy"],
		(id) => `/res/icon/${id}.svg`,
		(id) => `attributes/attribute_${id}.svg`,
	),
	save(
		[1, 2, 3, 4, 5, 18, 21, 45],
		(id) => `/res/icon/band_${id}.svg`,
		(id) => `bands/band_${id}.svg`,
	),
	save(
		Array.from({ length: 40 }, (_, idx) => idx + 1), // 1-40
		(id) => `/res/icon/chara_icon_${id}.png`,
		(id) => `characters/character_${id}.png`,
	),
]);
