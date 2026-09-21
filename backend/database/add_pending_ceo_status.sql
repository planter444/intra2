-- Add pending_ceo status to travel_requests check constraint
ALTER TABLE travel_requests
DROP CONSTRAINT IF EXISTS travel_requests_status_check;

ALTER TABLE travel_requests
ADD CONSTRAINT travel_requests_status_check
CHECK (status IN ('pending', 'pending_ceo', 'approved', 'rejected', 'cancelled', 'in_progress', 'completed'));
