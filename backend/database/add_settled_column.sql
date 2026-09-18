-- Add settled column to track if travel request has been paid/processed
ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS settled BOOLEAN NOT NULL DEFAULT FALSE;
