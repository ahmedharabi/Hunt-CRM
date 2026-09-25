-- Full-text search across names, notes and job descriptions.
-- One FTS5 table for every record kind, kept in sync by triggers.
CREATE VIRTUAL TABLE `search_index` USING fts5(
  kind UNINDEXED,
  ref_id UNINDEXED,
  title,
  body,
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3'
);
--> statement-breakpoint
CREATE TRIGGER `companies_search_ai` AFTER INSERT ON `companies` BEGIN
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('company', new.id, new.name, coalesce(new.industry,'') || ' ' || coalesce(new.hq_location,'') || ' ' || coalesce(new.country,'') || ' ' || coalesce(new.tech_stack,'') || ' ' || coalesce(new.notes,''));
END;
--> statement-breakpoint
CREATE TRIGGER `companies_search_au` AFTER UPDATE ON `companies` BEGIN
  DELETE FROM search_index WHERE kind = 'company' AND ref_id = old.id;
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('company', new.id, new.name, coalesce(new.industry,'') || ' ' || coalesce(new.hq_location,'') || ' ' || coalesce(new.country,'') || ' ' || coalesce(new.tech_stack,'') || ' ' || coalesce(new.notes,''));
END;
--> statement-breakpoint
CREATE TRIGGER `companies_search_ad` AFTER DELETE ON `companies` BEGIN
  DELETE FROM search_index WHERE kind = 'company' AND ref_id = old.id;
END;
--> statement-breakpoint
INSERT INTO search_index (kind, ref_id, title, body) SELECT 'company', id, name, coalesce(industry,'') || ' ' || coalesce(hq_location,'') || ' ' || coalesce(country,'') || ' ' || coalesce(tech_stack,'') || ' ' || coalesce(notes,'') FROM `companies`;
--> statement-breakpoint
CREATE TRIGGER `contacts_search_ai` AFTER INSERT ON `contacts` BEGIN
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('contact', new.id, new.name, coalesce(new.role,'') || ' ' || coalesce(new.email,'') || ' ' || coalesce(new.notes,''));
END;
--> statement-breakpoint
CREATE TRIGGER `contacts_search_au` AFTER UPDATE ON `contacts` BEGIN
  DELETE FROM search_index WHERE kind = 'contact' AND ref_id = old.id;
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('contact', new.id, new.name, coalesce(new.role,'') || ' ' || coalesce(new.email,'') || ' ' || coalesce(new.notes,''));
END;
--> statement-breakpoint
CREATE TRIGGER `contacts_search_ad` AFTER DELETE ON `contacts` BEGIN
  DELETE FROM search_index WHERE kind = 'contact' AND ref_id = old.id;
END;
--> statement-breakpoint
INSERT INTO search_index (kind, ref_id, title, body) SELECT 'contact', id, name, coalesce(role,'') || ' ' || coalesce(email,'') || ' ' || coalesce(notes,'') FROM `contacts`;
--> statement-breakpoint
CREATE TRIGGER `opportunities_search_ai` AFTER INSERT ON `opportunities` BEGIN
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('opportunity', new.id, new.title, coalesce(new.location,'') || ' ' || coalesce(new.notes,'') || ' ' || coalesce(new.job_description,'') || ' ' || coalesce(new.rejection_reason,''));
END;
--> statement-breakpoint
CREATE TRIGGER `opportunities_search_au` AFTER UPDATE ON `opportunities` BEGIN
  DELETE FROM search_index WHERE kind = 'opportunity' AND ref_id = old.id;
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('opportunity', new.id, new.title, coalesce(new.location,'') || ' ' || coalesce(new.notes,'') || ' ' || coalesce(new.job_description,'') || ' ' || coalesce(new.rejection_reason,''));
END;
--> statement-breakpoint
CREATE TRIGGER `opportunities_search_ad` AFTER DELETE ON `opportunities` BEGIN
  DELETE FROM search_index WHERE kind = 'opportunity' AND ref_id = old.id;
END;
--> statement-breakpoint
INSERT INTO search_index (kind, ref_id, title, body) SELECT 'opportunity', id, title, coalesce(location,'') || ' ' || coalesce(notes,'') || ' ' || coalesce(job_description,'') || ' ' || coalesce(rejection_reason,'') FROM `opportunities`;
--> statement-breakpoint
CREATE TRIGGER `activities_search_ai` AFTER INSERT ON `activities` BEGIN
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('activity', new.id, coalesce(new.subject,''), coalesce(new.summary,''));
END;
--> statement-breakpoint
CREATE TRIGGER `activities_search_au` AFTER UPDATE ON `activities` BEGIN
  DELETE FROM search_index WHERE kind = 'activity' AND ref_id = old.id;
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('activity', new.id, coalesce(new.subject,''), coalesce(new.summary,''));
END;
--> statement-breakpoint
CREATE TRIGGER `activities_search_ad` AFTER DELETE ON `activities` BEGIN
  DELETE FROM search_index WHERE kind = 'activity' AND ref_id = old.id;
END;
--> statement-breakpoint
INSERT INTO search_index (kind, ref_id, title, body) SELECT 'activity', id, coalesce(subject,''), coalesce(summary,'') FROM `activities`;
--> statement-breakpoint
CREATE TRIGGER `interviews_search_ai` AFTER INSERT ON `interviews` BEGIN
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('interview', new.id, new.stage, coalesce(new.prep_notes,'') || ' ' || coalesce(new.questions_asked,'') || ' ' || coalesce(new.feedback,''));
END;
--> statement-breakpoint
CREATE TRIGGER `interviews_search_au` AFTER UPDATE ON `interviews` BEGIN
  DELETE FROM search_index WHERE kind = 'interview' AND ref_id = old.id;
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('interview', new.id, new.stage, coalesce(new.prep_notes,'') || ' ' || coalesce(new.questions_asked,'') || ' ' || coalesce(new.feedback,''));
END;
--> statement-breakpoint
CREATE TRIGGER `interviews_search_ad` AFTER DELETE ON `interviews` BEGIN
  DELETE FROM search_index WHERE kind = 'interview' AND ref_id = old.id;
END;
--> statement-breakpoint
INSERT INTO search_index (kind, ref_id, title, body) SELECT 'interview', id, stage, coalesce(prep_notes,'') || ' ' || coalesce(questions_asked,'') || ' ' || coalesce(feedback,'') FROM `interviews`;
--> statement-breakpoint
CREATE TRIGGER `templates_search_ai` AFTER INSERT ON `templates` BEGIN
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('template', new.id, new.name, coalesce(new.subject,'') || ' ' || new.body);
END;
--> statement-breakpoint
CREATE TRIGGER `templates_search_au` AFTER UPDATE ON `templates` BEGIN
  DELETE FROM search_index WHERE kind = 'template' AND ref_id = old.id;
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('template', new.id, new.name, coalesce(new.subject,'') || ' ' || new.body);
END;
--> statement-breakpoint
CREATE TRIGGER `templates_search_ad` AFTER DELETE ON `templates` BEGIN
  DELETE FROM search_index WHERE kind = 'template' AND ref_id = old.id;
END;
--> statement-breakpoint
INSERT INTO search_index (kind, ref_id, title, body) SELECT 'template', id, name, coalesce(subject,'') || ' ' || body FROM `templates`;
