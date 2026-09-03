import z from "zod";

export const NumberAsDate = z.coerce.number().transform((n) => new Date(n));
export const RegionTuple = <T extends z.ZodType>(value: T) => {
	const nullable = value.nullable();
	return z.tuple([nullable, nullable, nullable, nullable, nullable]);
};

export const GameEventType = z.enum([
	"story",
	"versus",
	"mission_live",
	"challenge",
	"live_try",
	"medley",
	"festival",
]);

export const GameEvent = z.object({
	eventId: z.number(),
	eventType: GameEventType,
	eventName: z.string(),
	assetBundleName: z.string(),
	bgmAssetBundleName: z.string(),
	bgmFileName: z.string(),
	startAt: NumberAsDate,
	endAt: NumberAsDate,
});

export const GameMonthlyRanking = z.object({
	monthlyRankingId: z.number(),
	monthlyRankingName: z.string(),
	assetBundleName: z.string(),
	bgmAssetBundleName: z.string(),
	bgmFileName: z.string(),
	startAt: NumberAsDate,
	endAt: NumberAsDate,
});

export const GameMusic = z.object({
	musicId: z.number(),
	musicTitle: z.string(),
	bandId: z.number(),
	bgmId: z.string(),
	bgmFile: z.string(),
	jacketImage: z.string(),
});

export const GameAreaItem = z.object({
	areaItemName: z.string(),
	level: z.number(),

	performance: z.number(),
	technique: z.number(),
	visual: z.number(),
	targetAttributes: z
		.array(z.enum(["powerful", "pure", "cool", "happy"]))
		.catch([]),
	targetBandIds: z.array(z.number()).catch([]),
});

// /api/MasterDB_en.json
export const MasterDB = z.object({
	masterEventMap: z.object({
		entries: z.record(z.string(), GameEvent),
	}),
	masterMonthlyRankingList: z.object({
		entries: z.array(GameMonthlyRanking),
	}),

	...Object.fromEntries(
		(["Versus", "Challenge", "Medley"] as const).map((type) => [
			`master${type}EventMap` as const,
			z.object({
				entries: z
					.record(
						z.string(),
						z.object({ musics: z.array(z.object({ musicId: z.number() })) }),
					)
					.optional(),
			}),
		]),
	),
	masterMusicList: z.object({ entries: z.array(GameMusic) }),
	masterBandMap: z.object({
		entries: z.record(
			z.string(),
			z.object({
				bandName: z.string(),
				bandType: z.enum(["normal", "irregular"]),
			}),
		),
	}),

	masterAreaItemMap: z.object({
		entries: z
			.record(z.string(), GameAreaItem)
			.transform((entries) =>
				Object.fromEntries(
					Object.entries(entries).filter(
						([, { performance, technique, visual }]) =>
							performance > 0 || technique > 0 || visual > 0,
					),
				),
			),
	}),
	masterCharacterInfoMap: z.object({
		entries: z.record(z.string(), z.object({ firstName: z.string() })),
	}),

	system: z.object({ serverDate: z.coerce.number() }),
});

// /api/Versions_en.json
export const Versions = z.object({
	app: z.string(),
	res: z.string(),
	master: z.string(),
});
