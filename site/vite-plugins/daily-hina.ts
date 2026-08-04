import { exactRegex } from "@rolldown/pluginutils";
import * as devalue from "devalue";
import { Random } from "random";
import type { DailyHina } from "virtual:daily-hina";

import dayjs from "@bandori-stats/bestdori/date";
import { pick } from "@bandori-stats/bestdori/helpers";
import { fetchCards } from "@bandori-stats/bestdori/schema/cards";

export default function bandoriLeaderboard() {
	const virtualModuleId = "virtual:daily-hina";
	const resolvedVirtualModuleId = "\0" + virtualModuleId;

	return {
		name: "daily-hina",
		resolveId: {
			filter: { id: exactRegex(virtualModuleId) },
			handler() {
				return resolvedVirtualModuleId;
			},
		},
		load: {
			filter: { id: exactRegex(resolvedVirtualModuleId) },
			async handler() {
				const cards = await fetchCards(import.meta.env.DEV);
				const hinaCards = [...cards.entries()].filter(
					([, { characterId, rarity, type }]) =>
						characterId === 17 && (rarity === 5 || type === "limited"),
				);

				const rng = new Random(dayjs.tz().startOf("days").unix());
				const [id, card] = rng.choice(hinaCards)!;
				let trained = rng.boolean();
				if (card.stat.training === undefined) {
					// no trained art
					trained = false;
				} else if (
					card.stat.training.levelLimit === 0 ||
					card.type === "others"
				) {
					// only trained art available
					trained = true;
				}

				const module = {
					id,
					trained,
					...pick(card, ["resourceSetName"]),
				} satisfies DailyHina;
				return `export const dailyHina = ${devalue.uneval(module)}`;
			},
		},
	};
}
