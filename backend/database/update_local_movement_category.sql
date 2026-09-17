-- Update travel_category for existing local movement requests
-- Local movement requests have no accommodation (rate = 0 and amount = 0)
-- and were created before the travel_category field was properly set

UPDATE travel_requests
SET travel_category = 'Local Movement'
WHERE travel_category IS NULL
  AND (accommodation_rate IS NULL OR accommodation_rate = 0)
  AND (accommodation_amount IS NULL OR accommodation_amount = 0)
  AND (accommodation_currency IS NULL OR accommodation_currency = 'KES')
  AND created_at >= '2025-01-01'; -- Only update recent records

-- Verify the update
SELECT
    id,
    travel_type,
    travel_category,
    accommodation_rate,
    accommodation_amount,
    dsa_rate,
    dsa_amount,
    origin,
    destination
FROM travel_requests
WHERE travel_category = 'Local Movement'
LIMIT 10;
