ALTER TABLE `settings` ADD `timezone_auto` integer DEFAULT true NOT NULL;--> statement-breakpoint
-- Africa/Tunis was the old hard-coded default: anyone still on it never chose a timezone.
UPDATE `settings` SET `timezone_auto` = false WHERE `timezone` <> 'Africa/Tunis';
