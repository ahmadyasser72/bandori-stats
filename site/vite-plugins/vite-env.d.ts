declare module "virtual:bandori-leaderboard" {
	type Ranking = "event" | "song" | "monthly";
	type Rank = 1 | 2 | 3 | 10 | 100 | 1000 | 10_000;
	type MonthlyGrade = "silver" | "gold" | "platinum";
	type LiveGoals = "live-goals" | "ex-live-goals";
	type Category = `${Ranking}-t${Rank}` | `monthly-${MonthlyGrade}` | LiveGoals;

	type Player = Pick<
		import("@bandori-stats/database/schema").Account,
		"id" | "username" | "nickname" | "profileArt"
	>;
	interface PlayerData {
		player: Player;
		titles: number[];
	}

	interface BandoriLeaderboard {
		categories: Category[];
		titles: Record<Category | "uncategorized", number[]>;
		categoryByTitle: Map<number, Category | "uncategorized">;
		displayCategory: Record<Category | "uncategorized", string>;
		leaderboards: {
			global: Record<Category, PlayerData[]>;
			events: Record<
				number,
				{
					id: number;
					name: string;
					attribute: "powerful" | "cool" | "pure" | "happy";
					band: { id: number; name: string };
					characters: { id: number; name: string }[];
					type: string;

					items: Record<Category, PlayerData[]>;
					count: number;

					bannerAssetBundleName: string;
				}
			>;
		};
	}

	const {
		categories,
		titles,
		categoryByTitle,
		leaderboards,
		displayCategory,
	}: BandoriLeaderboard;
}
