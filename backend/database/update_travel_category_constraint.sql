-- Update travel_category constraint to include 'Local Movement'
-- Run this script to allow 'Local Movement' as a valid travel category

-- Drop the existing constraint
ALTER TABLE travel_requests
DROP CONSTRAINT IF EXISTS travel_requests_travel_category_check;

-- Add the updated constraint with 'Local Movement' included
ALTER TABLE travel_requests
ADD CONSTRAINT travel_requests_travel_category_check
CHECK (travel_category IN ('Within Kenya', 'East Africa', 'International', 'Local Movement'));
