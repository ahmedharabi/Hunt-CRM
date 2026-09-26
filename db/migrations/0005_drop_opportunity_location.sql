-- Country replaces the free-form location field. Keep whatever was typed there.
UPDATE `opportunities` SET `country` = `location` WHERE `country` IS NULL AND `location` IS NOT NULL AND `location` != '';
--> statement-breakpoint
-- The search triggers read the old column; SQLite won't drop it while they do.
DROP TRIGGER `opportunities_search_ai`;
--> statement-breakpoint
DROP TRIGGER `opportunities_search_au`;
--> statement-breakpoint
ALTER TABLE `opportunities` DROP COLUMN `location`;
--> statement-breakpoint
CREATE TRIGGER `opportunities_search_ai` AFTER INSERT ON `opportunities` BEGIN
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('opportunity', new.id, new.title, coalesce(new.country,'') || ' ' || coalesce(new.notes,'') || ' ' || coalesce(new.job_description,'') || ' ' || coalesce(new.rejection_reason,''));
END;
--> statement-breakpoint
CREATE TRIGGER `opportunities_search_au` AFTER UPDATE ON `opportunities` BEGIN
  DELETE FROM search_index WHERE kind = 'opportunity' AND ref_id = old.id;
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('opportunity', new.id, new.title, coalesce(new.country,'') || ' ' || coalesce(new.notes,'') || ' ' || coalesce(new.job_description,'') || ' ' || coalesce(new.rejection_reason,''));
END;
--> statement-breakpoint
DELETE FROM search_index WHERE kind = 'opportunity';
--> statement-breakpoint
INSERT INTO search_index (kind, ref_id, title, body) SELECT 'opportunity', id, title, coalesce(country,'') || ' ' || coalesce(notes,'') || ' ' || coalesce(job_description,'') || ' ' || coalesce(rejection_reason,'') FROM `opportunities`;
