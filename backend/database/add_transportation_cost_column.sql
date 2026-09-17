-- Add transportation_cost column to travel_requests table
-- This migration adds transportation cost field for reimbursement requests

-- Add transportation_cost column (actual transportation expenses incurred)
ALTER TABLE travel_requests ADD COLUMN IF NOT EXISTS transportation_cost NUMERIC(12, 2);

-- Add comment to document the column
COMMENT ON COLUMN travel_requests.transportation_cost IS 'Actual transportation expenses incurred during travel (optional, for reimbursement)';
