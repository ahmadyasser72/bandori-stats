import type { StatName } from "@bandori-stats/database/constants";
import { queue } from "@trigger.dev/sdk";

export const updateStat = (
	statName: StatName,
	stat: Record<`n_${StatName}` | `mean_${StatName}` | `m2_${StatName}`, number>,
	{ newValue, oldValue }: Record<"newValue" | "oldValue", number | null>,
) => {
	let n = stat[`n_${statName}`];
	let mean = stat[`mean_${statName}`];
	let m2 = stat[`m2_${statName}`];

	if (oldValue !== null) {
		if (n > 1) {
			const delta = oldValue - mean;
			mean -= delta / (n - 1);
			m2 -= delta * (oldValue - mean);
		} else {
			mean = 0;
			m2 = 0;
		}

		n -= 1;
	}

	if (newValue !== null) {
		const delta = newValue - mean;
		n += 1;
		mean += delta / n;
		m2 += delta * (newValue - mean);
	}

	return { n, mean, m2 };
};

export const zScoreQueue = queue({
	name: "z-score-queue",
	concurrencyLimit: 1,
});
