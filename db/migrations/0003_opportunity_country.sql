ALTER TABLE `opportunities` ADD `country` text;--> statement-breakpoint
-- Applications added from the opportunity form or the board used to skip the
-- activity log, so goals, streaks and the heatmap never saw them. Backfill one
-- application activity per applied opportunity that has none, dated applied_at.
INSERT INTO `activities` (`type`, `channel`, `direction`, `company_id`, `opportunity_id`, `subject`, `occurred_at`, `outcome`, `is_seed`)
SELECT 'application', 'company_site', 'outbound', o.`company_id`, o.`id`, o.`title`, o.`applied_at`,
  CASE o.`status` WHEN 'rejected' THEN 'negative' WHEN 'ghosted' THEN 'no_response' WHEN 'applied' THEN 'pending' WHEN 'withdrawn' THEN 'pending' ELSE 'replied' END,
  o.`is_seed`
FROM `opportunities` o
WHERE o.`applied_at` IS NOT NULL AND o.`deleted_at` IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `activities` a
    WHERE a.`opportunity_id` = o.`id` AND a.`type` = 'application' AND a.`direction` = 'outbound' AND a.`deleted_at` IS NULL
  );
