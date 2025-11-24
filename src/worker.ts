import type { SSRManifest } from "astro";
import { App } from "astro/app";

import { handle } from "@astrojs/cloudflare/handler";
import type { AppType } from "bestdori-leaderboard/src/app";
import { eq, sql } from "drizzle-orm";
import { hc } from "hono/client";

import { createDrizzle } from "./db";
import { accounts, accountSnapshots, latestSnapshots } from "./db/schema";

export function createExports(manifest: SSRManifest) {
	const app = new App(manifest);
	return {
		default: {
			async fetch(request, env, ctx) {
				// @ts-expect-error upstream types mismatch
				return handle(manifest, app, request, env, ctx);
			},
			async scheduled(_controller, env, ctx) {
				const db = createDrizzle(env.PLAYER_DB);
				const leaderboard = hc<AppType>(
					import.meta.env.DEV
						? "http://localhost:8787"
						: "https://bestdori-leaderboard.notsweet.deno.net/",
				);

				const { data: usernames } = await leaderboard.usernames
					.$get()
					.then((response) => response.json());

				const latestSnapshotsByUsername = Object.fromEntries(
					(await db.select().from(latestSnapshots)).map(
						({ username, ...rest }) => [username, rest],
					),
				);
				const { data: stats } = await leaderboard.stats
					.$get({
						query: {
							username: [
								...new Set([
									...usernames,
									...Object.keys(latestSnapshotsByUsername),
								]),
							],
						},
					})
					.then((response) => response.json());

				const queries = stats
					.filter(({ stat }) => !!stat)
					.flatMap(({ username, stat }) => {
						if (!stat) return [];

						const snapshot = latestSnapshotsByUsername[username];
						if (snapshot) {
							const { server, ...newStat } = stat;
							const { accountId, snapshotDate, ...previousStat } = snapshot;

							const isStatSame = Object.entries(newStat).every(
								([key, value]) =>
									previousStat[key as keyof typeof newStat] === value,
							);
							if (isStatSame) return [];

							return db
								.insert(accountSnapshots)
								.values({
									accountId,
									...previousStat,
									...newStat,
									snapshotDate: new Date().toISOString().slice(0, 10),
								})
								.onConflictDoUpdate({
									target: [
										accountSnapshots.accountId,
										accountSnapshots.snapshotDate,
									],
									set: stat,
								});
						}

						const insertNewAccount = db
							.insert(accounts)
							.values({ server: stat.server, username });
						const newAccount = db
							.$with("new_account")
							.as(
								db
									.select({ accountId: accounts.id })
									.from(accounts)
									.where(eq(accounts.username, username))
									.limit(1),
							);
						const insertSnapshot = db
							.with(newAccount)
							.insert(accountSnapshots)
							.values({
								accountId: sql`(select ${newAccount.accountId} from ${newAccount})`,
								...stat,
							});

						return [insertNewAccount, insertSnapshot];
					});

				ctx.waitUntil(db.batch(queries as never));
			},
		} satisfies ExportedHandler<CloudflareBindings>,
	};
}
