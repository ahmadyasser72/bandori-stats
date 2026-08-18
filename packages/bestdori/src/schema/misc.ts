import z from "zod";

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
	startAt: z.coerce.number(),
	endAt: z.coerce.number(),
});

export const GameMonthlyRanking = z.object({
	monthlyRankingId: z.number(),
	monthlyRankingName: z.string(),
	assetBundleName: z.string(),
	bgmAssetBundleName: z.string(),
	bgmFileName: z.string(),
	startAt: z.coerce.number(),
	endAt: z.coerce.number(),
});

export const GameAreaItem = z.object({
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

	system: z.object({ serverDate: z.coerce.number() }),
});

// /api/Versions_en.json
export const Versions = z.object({
	app: z.string(),
	res: z.string(),
	master: z.string(),
});
