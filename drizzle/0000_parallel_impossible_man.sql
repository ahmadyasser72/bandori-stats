CREATE TABLE `account_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`accountId` integer NOT NULL,
	`rank` integer,
	`clearCount` integer,
	`fullComboCount` integer,
	`allPerfectCount` integer,
	`highScoreRating` integer,
	`bandRating` integer,
	`snapshotDate` text DEFAULT (CURRENT_DATE) NOT NULL,
	FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_snapshots_account_date` ON `account_snapshots` (`accountId`,`snapshotDate`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`server` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_accounts_username` ON `accounts` (`username`);--> statement-breakpoint
CREATE VIEW `latest_snapshots` AS select "accounts"."id", "accounts"."username", "accounts"."server", "account_snapshots"."snapshotDate", "account_snapshots"."rank", "account_snapshots"."clearCount", "account_snapshots"."fullComboCount", "account_snapshots"."allPerfectCount", "account_snapshots"."highScoreRating", "account_snapshots"."bandRating" from "accounts" inner join (select "accountId", MAX("snapshotDate") as "latestDate" from "account_snapshots" group by "account_snapshots"."accountId") "latest" on "accounts"."id" = "latest"."accountId" inner join "account_snapshots" on ("account_snapshots"."accountId" = "latest"."accountId" and "account_snapshots"."snapshotDate" = "latestDate");