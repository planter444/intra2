-- Update travel category for specific requests
-- Run this script to fix incorrect travel_category values in the database

-- Update specific request IDs (replace with actual IDs from your database)
-- Example: Update request with ID 116 to 'Local Movement'
UPDATE travel_requests
SET travel_category = 'Local Movement'
WHERE id = 116;

-- Update request with ID 117 to 'Local Movement' (if needed)
-- UPDATE travel_requests
-- SET travel_category = 'Local Movement'
-- WHERE id = 117;

-- To find all requests that might need updating, you can run:
-- SELECT id, travel_type, travel_category, origin, destination
-- FROM travel_requests
-- ORDER BY created_at DESC;
