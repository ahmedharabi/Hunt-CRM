CREATE TABLE `saved_views` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	`is_seed` integer DEFAULT false NOT NULL,
	`entity` text NOT NULL,
	`name` text NOT NULL,
	`state` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `saved_views_entity_idx` ON `saved_views` (`entity`);