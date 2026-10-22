CREATE TABLE `checks` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`at` integer NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`opened` integer NOT NULL,
	`seen` integer NOT NULL,
	`resolved` integer,
	`level` text NOT NULL,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`muted` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `leases` (
	`key` text PRIMARY KEY NOT NULL,
	`until` integer NOT NULL,
	`owner` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
