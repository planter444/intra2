-- Add accommodation_provided column to travel_requests table
-- This migration adds a flag to indicate if accommodation was provided during travel

-- Add accommodation_provided column (boolean flag)
ALTER TABLE travel_requests ADD COLUMN IF NOT EXISTS accommodation_provided BOOLEAN DEFAULT FALSE;

-- Add comment to document the column
COMMENT ON COLUMN travel_requests.accommodation_provided IS 'Flag indicating if accommodation was provided during travel (excludes from reimbursement)';
