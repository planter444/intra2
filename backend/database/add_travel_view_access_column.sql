-- Add column for users who can view all travel requests
ALTER TABLE travel_notification_settings
ADD COLUMN IF NOT EXISTS view_all_travel_requests_ids BIGINT[] NOT NULL DEFAULT '{}';
