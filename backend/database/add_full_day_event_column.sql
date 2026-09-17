-- Add full_day_event column to travel_requests
-- This flag indicates if local movement travel is a full day event (eligible for DSA)

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS full_day_event BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN travel_requests.full_day_event IS 'For local movement travel, indicates if it is a full day event (eligible for DSA)';
