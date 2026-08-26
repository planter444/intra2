-- Add designation field to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS designation VARCHAR(50) CHECK (designation IN ('Field Officer', 'Intern', 'Secretariat', 'Consultant'));

-- Add new fields to travel_requests table
ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS designation VARCHAR(50) CHECK (designation IN ('Field Officer', 'Intern', 'Secretariat', 'Consultant'));

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS travel_category VARCHAR(30) CHECK (travel_category IN ('Within Kenya', 'East Africa', 'International'));

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS travel_type_detail VARCHAR(50) CHECK (travel_type_detail IN ('Official Overnight Travel', 'Official Day Travel'));

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS project_programme VARCHAR(50) CHECK (project_programme IN ('CWF', 'KEREA', 'WRI', 'CLASP', 'GIZ', 'GOGLA'));

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS dsa_rate NUMERIC(14,2);

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS dsa_currency VARCHAR(10) DEFAULT 'KES';

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS dsa_amount NUMERIC(14,2) DEFAULT 0;

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS dsa_provided BOOLEAN DEFAULT FALSE;

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(50);

-- Create index for reference number uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_travel_requests_reference ON travel_requests(reference_number) WHERE reference_number IS NOT NULL;

-- Update existing records with default designation based on role
UPDATE users
SET designation = CASE
  WHEN position_title ILIKE '%field%' THEN 'Field Officer'
  WHEN position_title ILIKE '%intern%' THEN 'Intern'
  WHEN position_title ILIKE '%secretariat%' OR position_title ILIKE '%admin%' THEN 'Secretariat'
  WHEN position_title ILIKE '%consultant%' THEN 'Consultant'
  ELSE 'Field Officer'
END
WHERE designation IS NULL;
