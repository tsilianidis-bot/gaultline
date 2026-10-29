-- Governed research rows are historical evidence. Later outcomes are appended as
-- governedResearchResolutions and never revise or remove prior observations.
-- This migration intentionally creates guards only; it does not recreate tables,
-- alter existing data, or remove an already-installed guard.
CREATE TRIGGER `governedResearchObservations_append_only_update`
BEFORE UPDATE ON `governedResearchObservations`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'governedResearchObservations append-only';
--> statement-breakpoint
CREATE TRIGGER `governedResearchObservations_append_only_delete`
BEFORE DELETE ON `governedResearchObservations`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'governedResearchObservations append-only';
--> statement-breakpoint
CREATE TRIGGER `governedResearchResolutions_append_only_update`
BEFORE UPDATE ON `governedResearchResolutions`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'governedResearchResolutions append-only';
--> statement-breakpoint
CREATE TRIGGER `governedResearchResolutions_append_only_delete`
BEFORE DELETE ON `governedResearchResolutions`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'governedResearchResolutions append-only';
