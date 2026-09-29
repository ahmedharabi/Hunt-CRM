ALTER TABLE `resume_versions` ADD `kind` text DEFAULT 'resume' NOT NULL;--> statement-breakpoint
ALTER TABLE `resume_versions` ADD `content` text;