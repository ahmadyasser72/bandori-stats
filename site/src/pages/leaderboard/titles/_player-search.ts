import type { Account } from "@bandori-stats/database/schema";

import MiniSearch from "minisearch";

export const playerSearchIndex = (
	players: Pick<Account, "username" | "nickname">[],
) => {
	const index = new MiniSearch<(typeof players)[number]>({
		fields: ["username", "nickname"],
		searchOptions: {
			combineWith: "OR",
			fuzzy: true,
			prefix: true,
			boost: { username: 2 },
		},
	});
	index.addAll(players);

	return index;
};
