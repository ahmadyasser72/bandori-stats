import {
	capitalize,
	pick,
	startCase,
	sumBy,
} from "@bandori-stats/bestdori/helpers";
import {
	compareDegreeRank,
	fetchDegrees,
	sortDegrees,
} from "@bandori-stats/bestdori/schema/degree";
import { db } from "@bandori-stats/database";
import { PLAYER_TITLES_SET, redis } from "@bandori-stats/database/redis";

import { exactRegex } from "@rolldown/pluginutils";
import * as devalue from "devalue";
import type {
	Category,
	Grade,
	PlayerData,
	Rank,
} from "virtual:bandori-leaderboard";
import z from "zod";

const fetchEvents = async () => {
	const response = await fetch(
		// https://github.com/ahmadyasser72/hina-is
		"https://hina-is.notsweet.workers.dev/data/events-all.json",
	);

	const schema = z.object({
		values: z.array(
			z.object({
				id: z.coerce.number().positive(),
				name: z.string().nonempty(),

				attribute: z.object({
					id: z.enum(["powerful", "cool", "pure", "happy"]),
				}),
				band: z.union([
					z.array(z.unknown()).nonempty(),
					z.object({
						id: z.coerce.number().positive(),
						name: z.string().nonempty(),
					}),
				]),
				characters: z.array(
					z.object({
						id: z.coerce.number().positive(),
						name: z.string().nonempty(),
					}),
				),
				type: z
					.enum([
						"normal",
						"vs-live",
						"mission-live",
						"challenge-live",
						"live-goals",
						"medley-live",
						"team-live-festival",
					])
					.transform((type) =>
						type === "vs-live" ? "VS Live" : startCase(type),
					),

				startAt: z.object({ en: z.number().nullable() }),
				titles: z.object({ raw: z.array(z.number().positive()).nonempty() }),

				bannerAssetBundleName: z.string(),
			}),
		),
	});

	const { values } = await response.json().then(schema.parse);
	return values.filter(({ startAt }) => startAt.en !== null);
};

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
				const events = await fetchEvents();
				const degrees = await fetchDegrees(import.meta.env.DEV);

				const titleIdToEventId = new Map<number, number>();
				for (const event of events) {
					for (const titleId of event.titles.raw) {
						titleIdToEventId.set(titleId, event.id);
					}
				}

				const playerTitles = (
					await redis().smembers<number[]>(PLAYER_TITLES_SET)
				)
					.map((id) => {
						const degree = degrees.get(id);
						return {
							id,
							type: degree?.degreeType.at(1) ?? null,
							name: degree?.baseImageName.at(1) ?? null,
							rank: degree?.rank.at(1) ?? null,
						};
					})
					.sort((a, b) => compareDegreeRank(a.rank, b.rank));

				const { tops, substitutes, titleIdToExactCategory } = (() => {
					const tops = new Map<Category, Set<number>>();
					const substitutes = new Map<number, number>();
					const titleIdToExactCategory = new Map<number, Category>();

					const getTitles = (category: Category) => {
						let titles = tops.get(category);
						if (!titles) {
							titles = new Set();
							tops.set(category, titles);
						}
						return titles;
					};

					const goals = new Map<string, { normal?: number; extra?: number }>();
					const monthly = new Map<
						string,
						{ silver?: number; gold?: number; platinum?: number }
					>();

					const byName = new Map<string, Map<number, Set<number>>>();

					for (const { id, type, name, rank } of playerTitles) {
						if (typeof name !== "string") continue;

						// live goals
						if (
							type === "try_clear" &&
							(rank === "normal" || rank === "extra")
						) {
							const exactCategory =
								rank === "normal" ? "live-goals" : "ex-live-goals";
							titleIdToExactCategory.set(id, exactCategory);

							let goal = goals.get(name);
							if (!goal) {
								goal = {};
								goals.set(name, goal);
							}

							goal[rank] = id;
							continue;
						}

						// monthly ranking
						if (typeof rank === "string" && rank.startsWith("grade_")) {
							const [, grade] = rank.split("_");
							titleIdToExactCategory.set(id, `monthly-${grade as Grade}`);

							let grades = monthly.get(name);
							if (!grades) {
								grades = {};
								monthly.set(name, grades);
							}

							grades[grade as Grade] = id;
							continue;
						}

						// general event point and song ranking (exclude t10k+)
						if (
							typeof rank !== "number" ||
							rank > 10_000 ||
							(type !== "event_point" && type !== "score_ranking")
						)
							continue;

						let normalized = rank;
						if (rank > 10 && rank < 100) normalized = 100;
						else if (rank > 100 && rank < 1000) normalized = 1000;
						else if (rank > 1000 && rank < 10_000) normalized = 10_000;

						const prefix = type === "event_point" ? "event" : "song";
						const exactCategory = `${prefix}-t${normalized as Rank}` as const;

						titleIdToExactCategory.set(id, exactCategory);

						let ranks = byName.get(`${prefix}:${name}`);
						if (!ranks) {
							ranks = new Map();
							byName.set(`${prefix}:${name}`, ranks);
						}

						let ids = ranks.get(normalized);
						if (!ids) {
							ids = new Set();
							ranks.set(normalized, ids);
						}
						ids.add(id);

						getTitles(exactCategory).add(id);
					}

					{
						const base = getTitles("live-goals");
						const ex = getTitles("ex-live-goals");

						for (const { normal, extra } of goals.values()) {
							if (normal) {
								base.add(normal);

								if (extra) substitutes.set(normal, extra);
							} else if (extra) {
								base.add(extra);
							}

							if (extra) ex.add(extra);
						}
					}

					{
						const silver = getTitles("monthly-silver");
						const gold = getTitles("monthly-gold");
						const platinum = getTitles("monthly-platinum");

						for (const grades of monthly.values()) {
							if (grades.silver) {
								silver.add(grades.silver);

								if (grades.gold) substitutes.set(grades.silver, grades.gold);
							}

							if (grades.gold) {
								gold.add(grades.gold);

								if (grades.platinum)
									substitutes.set(grades.gold, grades.platinum);
							}

							if (grades.platinum) platinum.add(grades.platinum);
						}
					}

					{
						const thresholds = [
							1, 2, 3, 10, 100, 1000, 10_000,
						] satisfies Rank[];

						for (const [key, ranks] of byName.entries()) {
							const prefix = key.split(":")[0] as "event" | "song";
							const inherited = new Set<number>();

							for (const threshold of thresholds) {
								const ids = ranks.get(threshold);
								if (ids) {
									for (const id of ids) inherited.add(id);
								}

								const titles = getTitles(`${prefix}-t${threshold}`);
								for (const id of inherited) titles.add(id);
							}
						}
					}

					return { tops, substitutes, titleIdToExactCategory };
				})();

				const categories = [
					"event-t1",
					"event-t2",
					"event-t3",
					"event-t10",
					"event-t100",
					"event-t1000",
					"event-t10000",
					"song-t1",
					"song-t2",
					"song-t3",
					"song-t10",
					"song-t100",
					"song-t1000",
					"song-t10000",
					"ex-live-goals",
					"live-goals",
					"monthly-platinum",
					"monthly-gold",
					"monthly-silver",
				] satisfies Category[];

				const titles = Object.fromEntries(
					[...tops.entries()]
						.sort(([a], [b]) => categories.indexOf(a) - categories.indexOf(b))
						.map(([k, set]) => [k, sortDegrees([...set], degrees)]),
				);

				const titlesSubstitutes = Object.fromEntries([
					...substitutes.entries(),
				]);
				const titlesDisplay = Object.fromEntries(
					categories.map((it): [Category, string] => {
						let out = "";
						if (it.startsWith("event-t") || it.startsWith("song-t")) {
							const [prefix, rank] = it.split("-");
							out = `${capitalize(prefix)} ${rank.toUpperCase()}`;
						} else if (it.endsWith("live-goals")) {
							out = it === "ex-live-goals" ? "EX Live Goals" : "Live Goals";
						} else if (it.startsWith("monthly")) {
							const [, grade] = it.split("-");
							out = `Monthly Ranking (${capitalize(grade)})`;
						}

						if (!out) throw new Error(`no display format defined for ${it}`);

						return [it, out];
					}),
				);

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

					const generatedGlobalLeaderboards = new Map<Category, PlayerData[]>();
					const generatedEventLeaderboards = new Map<
						number,
						Map<Category, Map<number, number[]>>
					>();

					for (const account of accounts) {
						const owned = new Set(account.snapshots.at(0)?.stats.titles ?? []);

						for (const titleId of owned) {
							const eventId = titleIdToEventId.get(titleId);

							if (eventId !== undefined) {
								const exactCategory = titleIdToExactCategory.get(titleId);

								if (exactCategory) {
									let eventCategoriesMap =
										generatedEventLeaderboards.get(eventId);
									if (!eventCategoriesMap) {
										eventCategoriesMap = new Map();
										generatedEventLeaderboards.set(eventId, eventCategoriesMap);
									}

									let playersMap = eventCategoriesMap.get(exactCategory);
									if (!playersMap) {
										playersMap = new Map();
										eventCategoriesMap.set(exactCategory, playersMap);
									}

									let playerTitles = playersMap.get(account.id);
									if (!playerTitles) {
										playerTitles = [];
										playersMap.set(account.id, playerTitles);
									}

									playerTitles.push(titleId);
								}
							}
						}

						for (const [category, categorySet] of tops.entries()) {
							const matchedTitles: number[] = [];

							for (const primaryTitle of categorySet) {
								let currentTitle: number | undefined = primaryTitle;

								while (currentTitle !== undefined) {
									if (owned.has(currentTitle)) {
										matchedTitles.push(primaryTitle);
										break;
									}
									currentTitle = substitutes.get(currentTitle);
								}
							}

							if (matchedTitles.length > 0) {
								let globalCategoryPlayers =
									generatedGlobalLeaderboards.get(category);
								if (!globalCategoryPlayers) {
									globalCategoryPlayers = [];
									generatedGlobalLeaderboards.set(
										category,
										globalCategoryPlayers,
									);
								}

								globalCategoryPlayers.push({
									id: account.id,
									titles: sortDegrees(matchedTitles, degrees),
								});
							}
						}
					}

					return {
						global: Object.fromEntries(
							[...generatedGlobalLeaderboards.entries()].map(
								([category, players]) => [
									category,
									players
										.sort((a, b) => b.titles.length - a.titles.length)
										.slice(0, 10),
								],
							),
						),
						events: (() => {
							const leaderboards: (typeof import("virtual:bandori-leaderboard"))["leaderboards"]["events"] =
								{};

							for (const [
								eventId,
								map,
							] of generatedEventLeaderboards.entries()) {
								const event = pick(
									events.find(({ id }) => eventId === id)!,
									[
										"id",
										"name",
										"attribute",
										"band",
										"characters",
										"type",
										"bannerAssetBundleName",
									],
								);

								const categoriesPerEvent = {} as Record<Category, PlayerData[]>;
								for (const [category, players] of map.entries()) {
									categoriesPerEvent[category] = [...players.entries()]
										.map(([id, titles]) => ({ id, titles }))
										.sort((a, b) => {
											const aDegree = degrees.get(a.titles[0])!;
											const bDegree = degrees.get(b.titles[0])!;
											return compareDegreeRank(
												aDegree.rank[1],
												bDegree.rank[1],
											);
										});
								}

								leaderboards[eventId] = {
									...event,
									count: sumBy(
										Object.values(categoriesPerEvent),
										(players) => players.length,
									),
									items: Object.fromEntries(
										Object.entries(categoriesPerEvent).sort(
											([a], [b]) =>
												categories.indexOf(a) - categories.indexOf(b),
										),
									),
								};
							}

							return leaderboards;
						})(),
					};
				})();

				const module = {
					categories,
					titles,
					titlesSubstitutes,
					titlesDisplay,
					leaderboards,
				};
				const exports = Object.keys(module);

				return `export const { ${exports.join(", ")} } = ${devalue.uneval(module)}`;
			},
		},
	};
}
