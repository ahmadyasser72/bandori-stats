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
export type BestdoriDegree = z.infer<typeof BestdoriDegree>;

const AllDegrees = z
	.record(z.string(), BestdoriDegree)
	.transform(
		(record) => new Map(Object.entries(record).map(([k, v]) => [Number(k), v])),
	);
export const fetchDegrees = () =>
	fetch("https://bestdori.com/api/degrees/all.3.json")
		.then((response) => response.json())
		.then(AllDegrees.parse);

type AllDegrees = z.infer<typeof AllDegrees>;
export const sortDegrees = (degrees: number[], allDegrees: AllDegrees) => {
	type DegreeRank = BestdoriDegree["rank"][0];
	const rankOrder = [
		"none",
		"normal",
		"extra",
		"grade_silver",
		"grade_gold",
		"grade_platinum",
	] satisfies Exclude<DegreeRank, number | null>[];
	const compareRank = (a: DegreeRank, b: DegreeRank) => {
		if (typeof a === "number" && typeof b === "number") return a - b;
		else if (a === null && b === null) return 0;
		else if (typeof a === "number") return -1;
		else if (typeof b === "number") return 1;
		else if (a === null) return 1;
		else if (b === null) return -1;
		else return rankOrder.indexOf(a) - rankOrder.indexOf(b);
	};

	const compareNullableString = (a: string | null, b: string | null) => {
		if (a === null && b === null) return 0;
		else if (a === null) return 1;
		else if (b === null) return -1;
		else return a.localeCompare(b);
	};

	return [...degrees].sort((a, b) => {
		const [aDegree, bDegree] = [allDegrees.get(a)!, allDegrees.get(b)!];

		return (
			compareRank(aDegree.rank[1], bDegree.rank[1]) ||
			compareNullableString(aDegree.baseImageName[1], bDegree.baseImageName[1])
		);
	});
};
