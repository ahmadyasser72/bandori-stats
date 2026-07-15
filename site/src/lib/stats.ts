import { compareValue, formatNumber } from "@bandori-stats/bestdori/helpers";
import type { Snapshot } from "@bandori-stats/database/schema";

export const computeStatDeltas = (
	currentStats: Snapshot["stats"],
	previousStats?: Snapshot["stats"],
) =>
	Object.entries(currentStats)
		.map(([name, value]): [typeof name, number] => [
			name,
			compareValue(value, previousStats?.[name]),
		])
		.filter(([, delta]) => delta > 0)
		.map(([name, delta]): [typeof name, string] => [
			name,
			formatNumber(delta, { autoCompact: true, positiveSign: true }),
		]);
