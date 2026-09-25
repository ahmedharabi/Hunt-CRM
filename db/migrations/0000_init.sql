CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	`is_seed` integer DEFAULT false NOT NULL,
	`type` text NOT NULL,
	`channel` text DEFAULT 'other' NOT NULL,
	`direction` text DEFAULT 'outbound' NOT NULL,
	`company_id` integer,
	`contact_id` integer,
	`opportunity_id` integer,
	`parent_activity_id` integer,
	`template_id` integer,
	`subject` text,
	`summary` text,
	`occurred_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`outcome` text DEFAULT 'pending' NOT NULL,
	`replied_at` integer,
	`follow_up_due_at` integer,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent_activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `activities_occurred_idx` ON `activities` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `activities_company_idx` ON `activities` (`company_id`);--> statement-breakpoint
CREATE INDEX `activities_contact_idx` ON `activities` (`contact_id`);--> statement-breakpoint
CREATE INDEX `activities_opportunity_idx` ON `activities` (`opportunity_id`);--> statement-breakpoint
CREATE INDEX `activities_parent_idx` ON `activities` (`parent_activity_id`);--> statement-breakpoint
CREATE INDEX `activities_follow_up_idx` ON `activities` (`follow_up_due_at`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	`is_seed` integer DEFAULT false NOT NULL,
	`name` text NOT NULL,
	`website` text,
	`linkedin_url` text,
	`logo_url` text,
	`industry` text,
	`size` text,
	`hq_location` text,
	`country` text,
	`timezone` text,
	`remote_policy` text,
	`tech_stack` text DEFAULT '[]' NOT NULL,
	`tier` text DEFAULT 'target' NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX `companies_name_idx` ON `companies` (`name`);--> statement-breakpoint
CREATE INDEX `companies_tier_idx` ON `companies` (`tier`);--> statement-breakpoint
CREATE TABLE `company_tags` (
	`company_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`company_id`, `tag_id`),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	`is_seed` integer DEFAULT false NOT NULL,
	`company_id` integer,
	`name` text NOT NULL,
	`role` text,
	`contact_type` text,
	`linkedin_url` text,
	`email` text,
	`notes` text,
	`last_contacted_at` integer,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `contacts_company_idx` ON `contacts` (`company_id`);--> statement-breakpoint
CREATE TABLE `interview_contacts` (
	`interview_id` integer NOT NULL,
	`contact_id` integer NOT NULL,
	PRIMARY KEY(`interview_id`, `contact_id`),
	FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `interviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	`is_seed` integer DEFAULT false NOT NULL,
	`opportunity_id` integer NOT NULL,
	`stage` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`duration_minutes` integer DEFAULT 45 NOT NULL,
	`prep_notes` text,
	`questions_asked` text,
	`self_rating` integer,
	`outcome` text DEFAULT 'scheduled' NOT NULL,
	`feedback` text,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `interviews_opp_idx` ON `interviews` (`opportunity_id`);--> statement-breakpoint
CREATE INDEX `interviews_when_idx` ON `interviews` (`scheduled_at`);--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	`is_seed` integer DEFAULT false NOT NULL,
	`company_id` integer NOT NULL,
	`title` text NOT NULL,
	`employment_type` text DEFAULT 'internship' NOT NULL,
	`work_mode` text,
	`location` text,
	`job_url` text,
	`source` text,
	`status` text DEFAULT 'wishlist' NOT NULL,
	`compensation` text,
	`deadline` integer,
	`applied_at` integer,
	`resume_version_id` integer,
	`cover_letter_used` integer DEFAULT false NOT NULL,
	`priority` integer DEFAULT 2 NOT NULL,
	`excitement` integer DEFAULT 3 NOT NULL,
	`notes` text,
	`job_description` text,
	`rejection_reason` text,
	`rejected_at_stage` text,
	`referred_by_contact_id` integer,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resume_version_id`) REFERENCES `resume_versions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`referred_by_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `opportunities_company_idx` ON `opportunities` (`company_id`);--> statement-breakpoint
CREATE INDEX `opportunities_status_idx` ON `opportunities` (`status`,`position`);--> statement-breakpoint
CREATE TABLE `opportunity_contacts` (
	`opportunity_id` integer NOT NULL,
	`contact_id` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`opportunity_id`, `contact_id`),
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `opportunity_tags` (
	`opportunity_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`opportunity_id`, `tag_id`),
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `resume_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	`is_seed` integer DEFAULT false NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`file_url` text,
	`file_path` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	`timezone` text DEFAULT 'Africa/Tunis' NOT NULL,
	`week_starts_on` integer DEFAULT 1 NOT NULL,
	`daily_goals` text DEFAULT '{"application":2,"cold_email":3,"linkedin_dm":3,"linkedin_connection":5,"follow_up":2}' NOT NULL,
	`weekly_goals` text DEFAULT '{"application":10,"cold_email":15,"linkedin_dm":15,"linkedin_connection":25,"follow_up":10}' NOT NULL,
	`follow_up_rules` text DEFAULT '{"cold_email":5,"linkedin_dm":7,"linkedin_connection":7,"referral_request":5,"application":10}' NOT NULL,
	`ghosting_threshold_days` integer DEFAULT 21 NOT NULL,
	`linkedin_weekly_connection_limit` integer DEFAULT 100 NOT NULL,
	`streak_mode` text DEFAULT 'any_goal' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `status_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	`is_seed` integer DEFAULT false NOT NULL,
	`opportunity_id` integer NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`changed_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `status_history_opp_idx` ON `status_history` (`opportunity_id`,`changed_at`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	`is_seed` integer DEFAULT false NOT NULL,
	`name` text NOT NULL,
	`color` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_idx` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	`is_seed` integer DEFAULT false NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`subject` text,
	`body` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weekly_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	`is_seed` integer DEFAULT false NOT NULL,
	`week_start` text NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_reviews_week_idx` ON `weekly_reviews` (`week_start`);