declare module "virtual:bandori-leaderboard" {
	type Rank = 1 | 2 | 3 | 10 | 100 | 1000 | 10_000;
	type Grade = "silver" | "gold" | "platinum";
	type LiveGoals = "live-goals" | "ex-live-goals";
	type Category =
		`event-t${Rank}` | `song-t${Rank}` | `monthly-${Grade}` | LiveGoals;

	type Player = Pick<
		import("@bandori-stats/database/schema").Account,
		"id" | "username" | "nickname" | "profileArt"
	>;
	interface PlayerData extends Player {
		titles: number[];
	}

	const categories: Category[];
	const titles: Record<Category, number[]>;
	const titlesSubstitutes: Record<number, number>;
	const titlesDisplay: Record<Category, string>;
	const leaderboards: {
		global: Record<Category, PlayerData[]>;
		events: Record<
			number,
			{
				id: number;
				name: string;
				attribute: { id: "powerful" | "cool" | "pure" | "happy" };
				band: unknown[] | { id: number; name: string };
				characters: { id: number; name: string }[];
				type: string;

				items: Record<Category, PlayerData[]>;
				count: number;

				bannerAssetBundleName: string;
			}
		>;
	};
}
