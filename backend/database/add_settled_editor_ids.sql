-- Add column for users who can edit settled status
ALTER TABLE travel_notification_settings
ADD COLUMN IF NOT EXISTS settled_editor_ids BIGINT[] NOT NULL DEFAULT '{}';
