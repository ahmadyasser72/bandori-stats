declare module "virtual:bandori-leaderboard" {
	type Rank = 1 | 2 | 3 | 10 | 100 | 1000 | 10_000;
	type Grade = "silver" | "gold" | "platinum";
	type Category = `t${Rank}` | `monthly-${Grade}`;

	const titles: Record<Category, number[]>;
	const leaderboards: Record<Category, { id: number; titles: number[] }[]>;
}
