CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	`is_seed` integer DEFAULT false NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`pinned` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notes_updated_idx` ON `notes` (`updated_at`);--> statement-breakpoint
CREATE TRIGGER `notes_search_ai` AFTER INSERT ON `notes` BEGIN
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('note', new.id, new.title, new.body);
END;
--> statement-breakpoint
CREATE TRIGGER `notes_search_au` AFTER UPDATE ON `notes` BEGIN
  DELETE FROM search_index WHERE kind = 'note' AND ref_id = old.id;
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('note', new.id, new.title, new.body);
END;
--> statement-breakpoint
CREATE TRIGGER `notes_search_ad` AFTER DELETE ON `notes` BEGIN
  DELETE FROM search_index WHERE kind = 'note' AND ref_id = old.id;
END;
