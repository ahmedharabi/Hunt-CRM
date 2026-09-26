ALTER TABLE `settings` ADD `streak_goals` text DEFAULT '{"application":2,"cold_email":3}' NOT NULL;--> statement-breakpoint
-- Start from the application and cold email daily goals already configured.
UPDATE `settings` SET `streak_goals` = json_object(
  'application', coalesce(json_extract(`daily_goals`, '$.application'), 2),
  'cold_email', coalesce(json_extract(`daily_goals`, '$.cold_email'), 3)
);
