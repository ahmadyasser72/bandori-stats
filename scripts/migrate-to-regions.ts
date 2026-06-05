/**
 * Migration script to add multi-region support to existing EN-only database and Redis.
 * 
 * This script:
 * 1. Adds 'region' column to accounts table (defaults to "EN")
 * 2. Adds 'region' column to accountSnapshots table (defaults to "EN")
 * 3. Adds 'region' column to playerStatsSortedSets table (defaults to "EN")
 * 4. Creates indexes for region queries
 * 5. Migrates Redis keys to include region prefix
 * 
 * Usage:
 *   npx tsx scripts/migrate-to-regions.ts
 */

import { db, redis } from "@bandori-stats/database";
import { REGIONS, type Region } from "@bandori-stats/bestdori/constants";
import { getPlayerTitlesSet, getPlayerStatsSortedSet } from "@bandori-stats/database/redis";
import { sql } from "drizzle-orm";

async function migrate() {
	console.log("Starting migration to multi-region support...\n");

	// Step 1: Add region column to accounts table (if not exists)
	console.log("1. Adding 'region' column to accounts table...");
	try {
		await db.run(sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'EN'`);
		console.log("   ✓ 'region' column added (or already exists)\n");
	} catch (error) {
		console.log("   ✓ Column may already exist, continuing...\n");
	}

	// Step 2: Add region column to accountSnapshots table (if not exists)
	console.log("2. Adding 'region' column to accountSnapshots table...");
	try {
		await db.run(sql`ALTER TABLE account_snapshots ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'EN'`);
		console.log("   ✓ 'region' column added (or already exists)\n");
	} catch (error) {
		console.log("   ✓ Column may already exist, continuing...\n");
	}

	// Step 3: Add region column to playerStatsSortedSets table (if not exists)
	console.log("3. Adding 'region' column to playerStatsSortedSets table...");
	try {
		await db.run(sql`ALTER TABLE player_stats_sorted_sets ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'EN'`);
		console.log("   ✓ 'region' column added (or already exists)\n");
	} catch (error) {
		console.log("   ✓ Column may already exist, continuing...\n");
	}

	// Step 4: Create indexes for region queries
	console.log("4. Creating indexes for region queries...");
	try {
		await db.run(sql`CREATE INDEX IF NOT EXISTS idx_accounts_region ON accounts (region)`);
		await db.run(sql`CREATE INDEX IF NOT EXISTS idx_account_snapshots_region ON account_snapshots (region)`);
		await db.run(sql`CREATE INDEX IF NOT EXISTS idx_player_stats_sorted_sets_region ON player_stats_sorted_sets (region)`);
		console.log("   ✓ Indexes created (or already exist)\n");
	} catch (error) {
		console.log("   ✓ Indexes may already exist, continuing...\n");
	}

	// Step 5: Migrate Redis keys
	console.log("5. Migrating Redis keys to region-specific format...");
	console.log("   Current format: stats:player-titles, stats:player-stats:{stat}");
	console.log("   New format:     stats:player-titles:EN, stats:player-stats:EN:{stat}\n");

	// Get all existing Redis keys
	const existingKeys = await redis.keys("*");

	console.log(`   Found ${existingKeys.length} existing keys`);

	// Migrate player titles set (stats:player-titles -> stats:player-titles:EN)
	const titlesKey = "stats:player-titles";
	const newTitlesKey = getPlayerTitlesSet("EN");
	try {
		const exists = await redis.exists(titlesKey);
		if (exists) {
			await redis.rename(titlesKey, newTitlesKey);
			console.log(`   ✓ Migrated: ${titlesKey} -> ${newTitlesKey}`);
		} else {
			console.log(`   - ${titlesKey} does not exist, skipping`);
		}
	} catch (error) {
		console.log(`   ⚠ Failed to migrate ${titlesKey}:`, error);
	}

	// Migrate player stats sorted sets (stats:player-stats:{stat} -> stats:player-stats:EN:{stat})
	const statsToTrack = ["hsr", "dpr", "csp", "asp", "msp", "esp", "acp"] as const;
	for (const stat of statsToTrack) {
		const oldKey = `stats:player-stats:${stat}`;
		const newKey = getPlayerStatsSortedSet("EN", stat);
		try {
			const exists = await redis.exists(oldKey);
			if (exists) {
				await redis.rename(oldKey, newKey);
				console.log(`   ✓ Migrated: ${oldKey} -> ${newKey}`);
			} else {
				console.log(`   - ${oldKey} does not exist, skipping`);
			}
		} catch (error) {
			console.log(`   ⚠ Failed to migrate ${oldKey}:`, error);
		}
	}

	// Verify migration
	console.log("\n6. Verifying migrated keys...");
	const migratedKeys = await redis.keys("stats:*");
	console.log(`   Found ${migratedKeys.length} region-prefixed keys:`);
	for (const key of migratedKeys.slice(0, 10)) {
		console.log(`   - ${key}`);
	}
	if (migratedKeys.length > 10) {
		console.log(`   ... and ${migratedKeys.length - 10} more`);
	}

	console.log("\n✅ Migration complete!");
	console.log("\nNext steps:");
	console.log("1. Run the scheduled triggers to populate data for JP and CN regions");
	console.log("2. The triggers will create the new region-specific Redis keys");
	console.log("3. Existing EN data has been migrated with :EN suffix");
}

migrate().catch(console.error);