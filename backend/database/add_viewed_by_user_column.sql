-- Add viewed_by_user column to travel_requests table
-- This column will track whether a specific user has viewed the request
-- Note: This is for API response optimization. The actual view tracking is in travel_request_views table.

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS viewed_by_user BOOLEAN DEFAULT FALSE;
