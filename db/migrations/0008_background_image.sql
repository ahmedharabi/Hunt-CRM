ALTER TABLE `settings` ADD `background_image` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `background_blur` integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `background_dim` integer DEFAULT 55 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `surface_opacity` integer DEFAULT 85 NOT NULL;