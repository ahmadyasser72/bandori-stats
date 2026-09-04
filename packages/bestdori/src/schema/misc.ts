import z from "zod";

export const NumberAsDate = z.coerce.number().transform((n) => new Date(n));
export const RegionTuple = <T extends z.ZodType>(value: T) => {
	const nullable = value.nullable();
	return z.tuple([nullable, nullable, nullable, nullable, nullable]);
};
export const IsEntries = <T extends z.ZodType>(value: T) =>
	z
		.object({ entries: value })
		.transform((value) => (value as { entries: z.infer<T> }).entries);

export const GameEventType = z.enum([
	"story",
	"versus",
	"mission_live",
	"challenge",
	"live_try",
	"medley",
	"festival",
]);

export const GameAttributes = z.enum(["powerful", "pure", "cool", "happy"]);
export const GameStats = z.object({
	performance: z.number(),
	technique: z.number(),
	visual: z.number(),
});

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

export const GameEventInfo = z.object({
	attributes: z.array(
		z.object({ attribute: GameAttributes, percent: z.number() }),
	),
	characters: z.array(
		z.object({ characterId: z.number(), percent: z.number() }),
	),
	eventCharacterParameterBonus: GameStats.optional(),
	eventAttributeAndCharacterBonus: z.object({
		pointPercent: z.number(),
		parameterPercent: z.number(),
	}),
	members: z
		.record(
			z.number(),
			z.object({
				situationId: z.number(),
				percent: z.number(),
			}),
		)
		.apply(IsEntries),
	limitBreaks: z
		.record(
			z.number(),
			z.array(z.object({ percent: z.number() })).apply(IsEntries),
		)
		.apply(IsEntries),

	musics: z.array(z.object({ musicId: z.number() })).optional(),
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

	...GameStats.shape,
	targetAttributes: z.array(GameAttributes).catch([]),
	targetBandIds: z.array(z.number()).catch([]),
});

export const GameCharacterSituation = z.object({
	situationId: z.number(),
	characterId: z.number(),
	rarity: z.number(),
	attribute: GameAttributes,
	situationSkillId: z.number(),
	levelLimit: z.number(),
	parameterMap: z.record(z.number(), GameStats),

	resourceSetName: z.string(),
	situationType: z.string(),
});

// /api/MasterDB_en.json
export const MasterDB = z.object({
	masterEventMap: z.record(z.string(), GameEvent).apply(IsEntries),
	masterMonthlyRankingList: z.array(GameMonthlyRanking).apply(IsEntries),

	...Object.fromEntries(
		(
			[
				"Story",
				"Versus",
				"MissionLive",
				"Challenge",
				"LiveTry",
				"Medley",
				"Festival",
			] as const
		).map((type) => [
			`master${type}EventMap` as const,
			z
				// only include newer events
				.looseRecord(z.number().min(309), GameEventInfo)
				.optional()
				.apply(IsEntries),
		]),
	),
	masterMusicList: z.array(GameMusic).apply(IsEntries),
	masterBandMap: z
		.record(
			z.string(),
			z.object({
				bandName: z.string(),
				bandType: z.enum(["normal", "irregular"]),
			}),
		)
		.apply(IsEntries),

	masterAreaItemMap: z
		.record(z.string(), GameAreaItem)
		.transform((entries) =>
			Object.fromEntries(
				Object.entries(entries).filter(
					([, { performance, technique, visual }]) =>
						performance > 0 || technique > 0 || visual > 0,
				),
			),
		)
		.apply(IsEntries),
	masterCharacterSituationMap: z
		.record(z.string(), GameCharacterSituation)
		.apply(IsEntries),
	masterSituationSkillMap: z
		.record(z.string(), z.object({ skillId: z.number() }))
		.apply(IsEntries),
	masterCharacterInfoMap: z
		.record(z.string(), z.object({ firstName: z.string() }))
		.apply(IsEntries),

	system: z.object({ serverDate: z.coerce.number() }),
});

// /api/Versions_en.json
export const Versions = z.object({
	app: z.string(),
	res: z.string(),
	master: z.string(),
});
