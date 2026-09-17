-- Update travel_category check constraint to include Local Movement
-- First, drop the existing constraint
ALTER TABLE travel_requests
DROP CONSTRAINT IF EXISTS travel_requests_travel_category_check;

-- Add the updated constraint with Local Movement included
ALTER TABLE travel_requests
ADD CONSTRAINT travel_requests_travel_category_check
CHECK (travel_category IN ('Within Kenya', 'East Africa', 'International', 'Local Movement'));
