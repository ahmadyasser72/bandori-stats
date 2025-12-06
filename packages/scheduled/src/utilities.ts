import { STAT_COLUMNS, type StatName } from "@bandori-stats/database/constants";

type Stat = Record<StatName, number | null>;

export const calculateStatDiff = (from: Stat, to: Stat) =>
	STAT_COLUMNS.reduce(
		(acc, column) => {
			const oldValue = from[column];
			const newValue = to[column];

			acc.details[column] =
				oldValue === null && newValue === null
					? 0
					: oldValue === null || newValue === null
						? (oldValue ?? newValue)!
						: newValue - oldValue;

			acc.delta += acc.details[column];
			return acc;
		},
		{
			delta: 0,
			details: Object.fromEntries(STAT_COLUMNS.map((column) => [column, 0])),
		},
	);
