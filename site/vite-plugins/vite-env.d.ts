declare module "virtual:bandori-leaderboard" {
	type Rank = 1 | 2 | 3 | 10 | 100 | 1000;
	type Grade = "silver" | "gold" | "platinum";
	type Category = `top-${Rank}` | `monthly-${Grade}`;

	const titles: Record<Category, number[]>;
	const leaderboards: Record<Category, { id: number; titles: number[] }[]>;
}
