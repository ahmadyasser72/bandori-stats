import z from "zod";

const regionTuple = <T extends z.ZodType>(value: T) => {
	const nullable = value.nullable();
	return z.tuple([nullable, nullable, nullable, nullable, nullable]);
};

export const BestdoriDegree = z.strictObject({
	degreeType: regionTuple(
		z.enum(["event_point", "score_ranking", "try_clear", "normal"]),
	),
	iconImageName: regionTuple(
		z
			.enum(["none", "event_point_icon", "opening_1", "opening_2"])
			.or(z.templateLiteral(["medley_", z.coerce.number()])),
	),
	baseImageName: regionTuple(z.string()),
	rank: regionTuple(
		z.union([
			z.coerce.number().positive(),
			z.enum([
				"none",
				"normal",
				"extra",
				"grade_silver",
				"grade_gold",
				"grade_platinum",
			]),
		]),
	),
	degreeName: regionTuple(z.string()),
});

export const BestdoriDegreeAll = z.record(z.string(), BestdoriDegree);

export type BestdoriDegree = z.infer<typeof BestdoriDegree>;
