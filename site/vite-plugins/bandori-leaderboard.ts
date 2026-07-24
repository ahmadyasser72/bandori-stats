import {
	compareDegreeRank,
	fetchDegrees,
} from "@bandori-stats/bestdori/schema/degree";
import { db } from "@bandori-stats/database";
import { PLAYER_TITLES_SET, redis } from "@bandori-stats/database/redis";

import { exactRegex } from "@rolldown/pluginutils";
import * as devalue from "devalue";
import type { Category, Grade, Rank } from "virtual:bandori-leaderboard";

export default function bandoriLeaderboard() {
	const virtualModuleId = "virtual:bandori-leaderboard";
	const resolvedVirtualModuleId = "\0" + virtualModuleId;

	return {
		name: "bandori-leaderboard",
		resolveId: {
			filter: { id: exactRegex(virtualModuleId) },
			handler() {
				return resolvedVirtualModuleId;
			},
		},
		load: {
			filter: { id: exactRegex(resolvedVirtualModuleId) },
			async handler() {
				const degrees = await fetchDegrees(import.meta.env.DEV);
				const playerTitles = (
					await redis().smembers<number[]>(PLAYER_TITLES_SET)
				)
					.map((id) => {
						const degree = degrees.get(id);
						return {
							id,
							name: degree?.baseImageName.at(1) ?? null,
							rank: degree?.rank.at(1) ?? null,
						};
					})
					.sort((a, b) => compareDegreeRank(a.rank, b.rank));

				const tops = new Map<Category, Set<number>>();
				const getTitles = (key: Category) => {
					let titles = tops.get(key);
					if (!titles) {
						titles = new Set();
						tops.set(key, titles);
					}

					return titles;
				};

				const byName = new Map<string, Map<number, Set<number>>>();
				for (const { id, name, rank } of playerTitles) {
					if (typeof name !== "string") continue;
					if (typeof rank === "string" && rank.startsWith("grade_")) {
						const grades = ["silver", "gold", "platinum"] as const;

						const [, thisGrade] = rank.split("_");
						const gradeIdx = grades.indexOf(thisGrade as Grade);
						for (const grade of grades.slice(0, gradeIdx + 1))
							getTitles(`monthly-${grade}`).add(id);

						continue;
					}
					if (typeof rank !== "number" || rank > 10_000) continue;

					let normalized = rank;
					if (rank > 10 && rank < 100) normalized = 100;
					else if (rank > 100 && rank < 1000) normalized = 1000;
					else if (rank > 1000 && rank < 10_000) normalized = 10_000;

					let ranks = byName.get(name);
					if (!ranks) {
						ranks = new Map();
						byName.set(name, ranks);
					}

					let ids = ranks.get(normalized);
					if (!ids) {
						ids = new Set();
						ranks.set(normalized, ids);
					}
					ids.add(id);

					getTitles(`t${normalized as Rank}`).add(id);
				}

				const thresholds = [1, 2, 3, 10, 100, 1000, 10_000] satisfies Rank[];
				for (const ranks of byName.values()) {
					const inherited = new Set<number>();

					for (const threshold of thresholds) {
						const ids = ranks.get(threshold);
						if (ids) {
							for (const id of ids) inherited.add(id);
						}

						const titles = getTitles(`t${threshold}`);
						for (const id of inherited) titles.add(id);
					}
				}

				const leaderboards = await (async () => {
					const accounts = await db().query.accounts.findMany({
						columns: { id: true },
						with: {
							snapshots: {
								limit: 1,
								columns: { stats: true },
								orderBy: { id: "desc" },
							},
						},
					});

					return Object.fromEntries(
						[...tops.entries()].map(([category, set]) => {
							const players = accounts
								.map(({ id, snapshots }) => {
									const titles =
										snapshots
											.at(0)
											?.stats.titles?.filter((id) => set.has(id)) ?? [];
									if (titles.length === 0) return null;

									return { id, titles };
								})
								.filter((p): p is NonNullable<typeof p> => p !== null)
								.sort((a, b) => b.titles.length - a.titles.length)
								.slice(0, 10);

							return [category, players];
						}),
					);
				})();

				const sorted = (() => {
					const keys: Category[] = [
						"t1",
						"t2",
						"t3",
						"t10",
						"t100",
						"t1000",
						"t10000",
						"monthly-platinum",
						"monthly-gold",
						"monthly-silver",
					];

					return Object.fromEntries(
						[...tops.entries()]
							.sort(([a], [b]) => keys.indexOf(a) - keys.indexOf(b))
							.map(([key, set]) => [key, [...set]]),
					);
				})();

				return [
					`export const titles = ${devalue.uneval(sorted)}`,
					`export const leaderboards = ${devalue.uneval(leaderboards)}`,
				].join(";");
			},
		},
	};
}
