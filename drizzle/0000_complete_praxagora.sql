CREATE TABLE `account_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`rank` integer,
	`clear_count` integer,
	`full_combo_count` integer,
	`all_perfect_count` integer,
	`high_score_rating` integer,
	`band_rating` integer,
	`snapshot_date` text DEFAULT (CURRENT_DATE) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_snapshots_account_date` ON `account_snapshots` (`account_id`,`snapshot_date`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`server` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_accounts_username` ON `accounts` (`username`);--> statement-breakpoint
CREATE VIEW `latest_snapshots` AS select "accounts"."id", "accounts"."username", "accounts"."server", "account_snapshots"."snapshotDate", "account_snapshots"."rank", "account_snapshots"."clearCount", "account_snapshots"."fullComboCount", "account_snapshots"."allPerfectCount", "account_snapshots"."highScoreRating", "account_snapshots"."bandRating" from "accounts" inner join (select "accountId", MAX("snapshotDate") as "latestDate" from "account_snapshots" group by "account_snapshots"."account_id") "latest" on "accounts"."id" = "latest"."account_id" inner join "account_snapshots" on ("account_snapshots"."account_id" = "latest"."account_id" and "account_snapshots"."snapshot_date" = "latestDate");