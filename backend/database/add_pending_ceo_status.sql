-- Add pending_ceo status to travel_requests check constraint
-- First, drop the existing constraint if it exists
ALTER TABLE travel_requests
DROP CONSTRAINT IF EXISTS travel_requests_status_check;

-- Add the updated constraint with pending_ceo included
ALTER TABLE travel_requests
ADD CONSTRAINT travel_requests_status_check
CHECK (status IN ('pending', 'pending_ceo', 'approved', 'rejected', 'cancelled', 'in_progress', 'completed'));

