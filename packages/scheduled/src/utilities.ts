import { STAT_COLUMNS, type Stat } from "@bandori-stats/database/constants";

export const compareStats = (from: Stat, to: Stat) =>
	STAT_COLUMNS.reduce(
		(acc, column) => {
			const oldValue = from[column];
			const newValue = to[column];

			acc.difference[column] =
				oldValue === null && newValue === null
					? 0
					: oldValue === null || newValue === null
						? (oldValue ?? newValue)!
						: newValue - oldValue;

			acc.delta += acc.difference[column];
			return acc;
		},
		{
			delta: 0,
			difference: Object.fromEntries(STAT_COLUMNS.map((column) => [column, 0])),
		},
	);
