import { STAT_COLUMNS, type Stat } from "@bandori-stats/database/constants";

const compare = <T extends number>(a: T | null, b: T | null) => {
	if (a === null && b === null) return 0;
	else if (a !== null && b !== null) return Math.abs(a - b);
	return (a ?? b)!;
};

export const compareStats = (from: Stat, to: Stat) => {
	const { delta, difference } = STAT_COLUMNS.reduce(
		(acc, column) => {
			acc.difference[column] = compare(from[column], to[column]);
			acc.delta += acc.difference[column];
			return acc;
		},
		{
			delta: 0,
			difference: Object.fromEntries(STAT_COLUMNS.map((column) => [column, 0])),
		},
	);

	const titles = compare(
		from.titles?.length ?? null,
		to.titles?.length ?? null,
	);
	return {
		delta: delta + titles,
		difference: { ...difference, titles },
	};
};
