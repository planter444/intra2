-- Add supervisor_comment and ceo_comment columns to travel_requests table
-- These columns will store optional comments from supervisor and CEO during approval

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS supervisor_comment TEXT;

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS ceo_comment TEXT;

-- Add comments to document the columns
COMMENT ON COLUMN travel_requests.supervisor_comment IS 'Optional comments from immediate supervisor when approving/rejecting travel request';
COMMENT ON COLUMN travel_requests.ceo_comment IS 'Optional comments from CEO when approving/rejecting travel request';
