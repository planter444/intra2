-- Add dsa_provided column to travel_requests table
-- This migration adds a flag to indicate if DSA was provided during travel

-- Add dsa_provided column (boolean flag)
ALTER TABLE travel_requests ADD COLUMN IF NOT EXISTS dsa_provided BOOLEAN DEFAULT FALSE;

-- Add comment to document the column
COMMENT ON COLUMN travel_requests.dsa_provided IS 'Flag indicating if DSA was provided during travel (excludes from reimbursement)';
