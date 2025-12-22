import { STAT_NAMES, type Stats } from "@bandori-stats/bestdori/constants";

const compare = <T extends number>(a: T | null, b: T | null) => {
	if (a === null && b === null) return 0;
	else if (a !== null && b !== null) return Math.abs(a - b);
	return (a ?? b)!;
};

export const compareStats = (from: Stats, to: Stats) => {
	const { delta, difference } = STAT_NAMES.reduce(
		(acc, name) => {
			acc.difference[name] = compare(from[name], to[name]);
			acc.delta += acc.difference[name];
			return acc;
		},
		{
			delta: 0,
			difference: Object.fromEntries(STAT_NAMES.map((name) => [name, 0])),
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
