# 1. OBJECTIVE

Make the app cross-region to support three Bestdori servers: JP (server 0), EN (server 1), and CN (server 3). This includes:
- Multi-region routing via URL subpaths (`/jp/`, `/en/`, `/cn/`)
- A root landing page with links to all region-specific pages
- Trigger.dev scheduled tasks rotating through regions daily
- Redis key namespacing with region prefixes/suffixes
- Database schema changes to store server region per account

# 2. CONTEXT SUMMARY

**Current Architecture:**
- Single-region app that fetches data from `bestdori.com` API (defaults to JP/EN)
- Database stores accounts with `username`, `nickname`, `uid`, `lastUpdated`
- Redis stores player stats sorted sets and title sets
- Trigger.dev runs scheduled tasks for snapshot updates and leaderboard fetches
- Site serves pages at root level (`/history`, `/compare`)
- Discord bot provides stats lookup commands

**Key Files:**
- `packages/bestdori/src/constants.ts` - Stat definitions (no region support yet)
- `packages/database/src/schema/index.ts` - Database schema (accounts table)
- `packages/database/src/redis.ts` - Redis key constants
- `packages/scheduled/src/trigger/schedule-update-snapshots.ts` - Daily snapshot scheduler
- `packages/scheduled/src/trigger/schedule-update-accounts.ts` - Monthly account updater
- `packages/scheduled/src/trigger/bestdori-leaderboard.ts` - Leaderboard fetcher
- `site/src/pages/index.astro` - Homepage
- `site/src/middleware.ts` - Request middleware
- `packages/bestdori/src/schema/player/stats.ts` - Player stats API schema (has `server` field)

# 3. APPROACH OVERVIEW

1. **Define Region Type**: Add `Region` type with constants (`JP`, `EN`, `CN`) in `packages/bestdori/src/constants.ts`

2. **Database Schema Changes**: Add `server` column to `accounts` table to store region (0=JP, 1=EN, 3=CN)

3. **Redis Key Namespacing**: Modify Redis key generation to include region prefix/suffix in `packages/database/src/redis.ts`

4. **Region-Aware API Client**: Update `packages/scheduled/src/bestdori.ts` to accept region parameter for API calls

5. **Trigger Rotation**: Modify `schedule-update-snapshots.ts` and `schedule-update-accounts.ts` to rotate through regions daily

6. **Site Routing**: Configure Astro for region subpaths and update all pages to be region-aware

7. **Root Landing Page**: Create homepage with region selection links

# 4. IMPLEMENTATION STEPS

## Step 1: Define Region Constants
**Goal:** Add region type and constants to the bestdori package

**Method:** Edit `packages/bestdori/src/constants.ts` to add:
- `Region` type: `0 | 1 | 3` (corresponding to JP, EN, CN server indices)
- `REGIONS` array: `[{ id: 0, name: "JP" }, { id: 1, name: "EN" }, { id: 3, name: "CN" }]`
- `getRegionName(region: Region)` helper function
- `getRegionFromId(id: number)` helper function

**Reference:** `packages/bestdori/src/constants.ts`

---

## Step 2: Update Database Schema
**Goal:** Add server column to accounts table

**Method:** Edit `packages/database/src/schema/index.ts`:
- Add `server: integer().$type<Region>()` column to `accounts` table
- The column should store 0, 1, or 3 representing JP, EN, CN

**Reference:** `packages/database/src/schema/index.ts`

---

## Step 3: Update Redis Key Functions
**Goal:** Add region namespacing to all Redis keys

**Method:** Edit `packages/database/src/redis.ts`:
- Remove static key constants (`PLAYER_TITLES_SET`, `PLAYER_STATS_SORTED_SET_PREFIX`)
- Add `getPlayerTitlesSet(region: Region)` function returning `stats:${region}:player-titles`
- Add `getPlayerStatsSortedSet(region: Region, stat: StatName)` function returning `stats:${region}:player-stats:${stat}`
- Update `getGlobalMaxes()` in `chart.ts` to accept region parameter

**Reference:** `packages/database/src/redis.ts`

---

## Step 4: Update API Client for Region
**Goal:** Make bestdori API calls region-aware

**Method:** Edit `packages/scheduled/src/bestdori.ts`:
- Add `region: Region` parameter to `bestdori()` function
- Use region ID as `server` query parameter in API calls

**Reference:** `packages/scheduled/src/bestdori.ts`

---

## Step 5: Update Leaderboard Fetcher
**Goal:** Fetch leaderboards for the correct region

**Method:** Edit `packages/scheduled/src/trigger/bestdori-leaderboard.ts`:
- Add `region: Region` to task schema
- Pass region to `bestdori()` function call

**Reference:** `packages/scheduled/src/trigger/bestdori-leaderboard.ts`

---

## Step 6: Update Account Updater
**Goal:** Store region when syncing accounts

**Method:** Edit `packages/scheduled/src/trigger/schedule-update-accounts.ts`:
- Add `region: Region` parameter to leaderboard requests
- Store server region when inserting/updating accounts

**Reference:** `packages/scheduled/src/trigger/schedule-update-accounts.ts`

---

## Step 7: Update Stats Updater
**Goal:** Pass region through stats update pipeline

**Method:** Edit `packages/scheduled/src/trigger/update-stats.ts`:
- Add `region: Region` to task schema
- Pass region to `updateStatsRedis` trigger
- Update database queries to filter by region

**Reference:** `packages/scheduled/src/trigger/update-stats.ts`

---

## Step 8: Update Redis Stats Task
**Goal:** Use region-specific Redis keys

**Method:** Edit `packages/scheduled/src/trigger/update-stats-redis.ts`:
- Add `region: Region` to task schema
- Use region-specific key functions from redis module

**Reference:** `packages/scheduled/src/trigger/update-stats-redis.ts`

---

## Step 9: Implement Daily Region Rotation
**Goal:** Schedule triggers to run different region each day

**Method:** Edit `packages/scheduled/src/trigger/schedule-update-snapshots.ts`:
- Add cron trigger for each region (JP, EN, CN) or single cron with region rotation
- Calculate region based on day of week or day of month:
  - Day 1, 4, 7, 10, 13, 16, 19, 22, 25, 28 → JP
  - Day 2, 5, 8, 11, 14, 17, 20, 23, 26, 29 → EN
  - Day 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 31 → CN
- Filter accounts by region before triggering update tasks

**Reference:** `packages/scheduled/src/trigger/schedule-update-snapshots.ts`

---

## Step 10: Configure Astro Region Subpaths
**Goal:** Set up URL routing with region prefixes

**Method:** Edit `site/astro.config.mjs`:
- Configure `base` option or use dynamic routing middleware
- Option A: Use `base: "/jp"` etc. per deployment
- Option B: Use Astro middleware to detect region from URL and inject into locals

**Reference:** `site/astro.config.mjs`, `site/src/middleware.ts`

---

## Step 11: Update Site Middleware
**Goal:** Extract and validate region from URL

**Method:** Edit `site/src/middleware.ts`:
- Detect region from first path segment (`/jp/`, `/en/`, `/cn/`)
- Store region in `Astro.locals.region`
- Redirect root `/` to region selector or show landing page
- Apply region to all database queries

**Reference:** `site/src/middleware.ts`

---

## Step 12: Create Root Landing Page
**Goal:** Provide region selection at root URL

**Method:** Edit `site/src/pages/index.astro`:
- Show landing page with links to `/jp/`, `/en/`, `/cn/`
- Remove direct links to `/history`, `/compare`
- Use meta redirect or client-side navigation

**Reference:** `site/src/pages/index.astro`

---

## Step 13: Update All Page Paths
**Goal:** Make all pages region-aware

**Method:** Edit pages in `site/src/pages/`:
- Update breadcrumbs to include region
- Update all internal links to include region prefix
- Update HTMX endpoints to include region in URLs
- Update `history/rows.astro` API endpoint

**Reference:** `site/src/pages/history/index.astro`, `site/src/pages/compare/index.astro`, etc.

---

## Step 14: Update Static Title Generation
**Goal:** Use region-specific Redis keys for titles

**Method:** Edit `site/src/pages/static/titles/[id].webp.ts`:
- Accept region from middleware/locals
- Use region-specific titles set

**Reference:** `site/src/pages/static/titles/[id].webp.ts`

---

## Step 15: Update Discord Bot
**Goal:** Support region selection in Discord commands

**Method:** Edit `packages/discord-bot/src/commands/get-stats.ts` and `compare-stats.ts`:
- Add region option to commands (optional, defaults to EN)
- Filter accounts by region in queries
- Update profile links to use correct region

**Reference:** `packages/discord-bot/src/commands/get-stats.ts`

# 5. TESTING AND VALIDATION

**Success Criteria:**
1. Root URL (`/`) shows region selection with links to `/jp/`, `/en/`, `/cn/`
2. Each region path (`/jp/history`, `/en/compare`, etc.) displays region-specific data
3. Redis keys contain region identifiers (e.g., `stats:0:player-titles` for JP)
4. Database `accounts` table has `server` column with values 0, 1, or 3
5. Scheduled triggers process different region each day
6. Discord bot can query stats by region
7. No cross-region data leakage (JP accounts don't appear in EN views)

**Validation Steps:**
1. Verify database migration adds `server` column
2. Check Redis keys for correct region prefix after running triggers
3. Test site navigation through all region paths
4. Verify scheduled task logs show region rotation
5. Test Discord commands with different region filters
