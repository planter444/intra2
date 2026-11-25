-- Add column for CEO approval routing setting
ALTER TABLE travel_notification_settings 
ADD COLUMN IF NOT EXISTS ceo_approval_routing VARCHAR(50) DEFAULT 'chairman';

-- Possible values: 'self' (CEO approves herself) or 'chairman' (chairman approves CEO requests)
