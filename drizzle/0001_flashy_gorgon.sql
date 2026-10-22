CREATE INDEX `checks_site_at` ON `checks` (`site_id`,`at`);--> statement-breakpoint
CREATE UNIQUE INDEX `incidents_active_key` ON `incidents` (`key`) WHERE "incidents"."resolved" IS NULL;