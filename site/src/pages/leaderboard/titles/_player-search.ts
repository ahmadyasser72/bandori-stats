import MiniSearch from "minisearch";

import type { Player, PlayerData } from "virtual:bandori-leaderboard";

export const playerSearchIndex = (players: Pick<PlayerData, "player">[]) => {
	const index = new MiniSearch<Player>({
		fields: ["username", "nickname"],
		searchOptions: {
			combineWith: "OR",
			fuzzy: true,
			prefix: true,
			boost: { username: 2 },
		},
	});
	index.addAll(players.map(({ player }) => player));

	return index;
};
