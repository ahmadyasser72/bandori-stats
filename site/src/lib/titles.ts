import {
	titles,
	titlesSubstitutes,
	type Category,
} from "virtual:bandori-leaderboard";

export const getOwnedTitles = (owned: number[], category: Category) => {
	const matched: number[] = [];

	for (const primary of titles[category]) {
		let current: number | undefined = primary;

		while (current !== undefined) {
			if (owned.includes(current)) {
				matched.push(primary);
				break;
			}

			current = titlesSubstitutes[current];
		}
	}

	return matched;
};
