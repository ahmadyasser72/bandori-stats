import { titlesLookup, type Category } from "virtual:bandori-leaderboard";

import { groupBy } from "@bandori-stats/bestdori/helpers";

interface CategorizeOptions<C extends string> {
	lookup?: (id: number) => C;
	categories: C[];
}

interface CategorizeResult<C extends string> {
	grouped: Record<C, number[]>;
	categorized: { category: C; id: number }[];
}

export const categorize = <C extends string = Category>(
	titles: number[],
	{
		lookup = (id) => titlesLookup.get(id)!.category as C,
		categories,
	}: CategorizeOptions<C>,
): CategorizeResult<C> => {
	const grouped = groupBy(titles, lookup);

	return {
		grouped,
		categorized: categories
			.filter((category) => category in grouped)
			.flatMap((category) => grouped[category].map((id) => ({ category, id }))),
	};
};
