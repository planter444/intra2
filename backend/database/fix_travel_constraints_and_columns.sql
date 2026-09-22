-- Comprehensive migration to fix travel request constraints and ensure all columns exist
-- Run this script on your Render PostgreSQL database

-- 1. Update travel_category constraint to include 'Local Movement'
ALTER TABLE travel_requests
DROP CONSTRAINT IF EXISTS travel_requests_travel_category_check;

ALTER TABLE travel_requests
ADD CONSTRAINT travel_requests_travel_category_check
CHECK (travel_category IN ('Within Kenya', 'East Africa', 'International', 'Local Movement'));

-- 2. Update status constraint to include 'pending_ceo'
ALTER TABLE travel_requests
DROP CONSTRAINT IF EXISTS travel_requests_status_check;

ALTER TABLE travel_requests
ADD CONSTRAINT travel_requests_status_check
CHECK (status IN ('pending', 'pending_ceo', 'approved', 'rejected', 'cancelled', 'in_progress', 'completed'));

-- 3. Ensure all required columns exist (using IF NOT EXISTS for safety)
ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS designation VARCHAR(50) CHECK (designation IN ('Field Officer', 'Intern', 'Secretariat', 'Consultant'));

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS travel_category VARCHAR(30);

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
ADD COLUMN IF NOT EXISTS accommodation_rate NUMERIC(12,2);

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS accommodation_currency VARCHAR(3) DEFAULT 'KES';

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS accommodation_amount NUMERIC(12,2);

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS accommodation_provided BOOLEAN DEFAULT FALSE;

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS transportation_cost NUMERIC(14,2);

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS full_day_event BOOLEAN DEFAULT FALSE;

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(50);

ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS settled BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Create index for reference number uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_travel_requests_reference ON travel_requests(reference_number) WHERE reference_number IS NOT NULL;

-- 5. Update existing local movement requests to have correct category
UPDATE travel_requests
SET travel_category = 'Local Movement'
WHERE id IN (116, 117, 118);
