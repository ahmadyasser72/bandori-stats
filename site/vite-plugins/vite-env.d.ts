declare module "virtual:bandori-leaderboard" {
	type Rank = 1 | 2 | 3 | 10 | 100 | 1000 | 10_000;
	type Grade = "silver" | "gold" | "platinum";
	type LiveGoals = "live-goals" | "ex-live-goals";
	type Category = `t${Rank}` | `monthly-${Grade}` | LiveGoals;

	const categories: Category[];
	const titles: Record<Category, number[]>;
	const titlesSubstitutes: Record<number, number>;
	const titlesDisplay: Record<Category, string>;
	const leaderboards: Record<Category, { id: number; titles: number[] }[]>;
}
