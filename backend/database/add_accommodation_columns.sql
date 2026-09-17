-- Add accommodation columns to travel_requests table
-- This migration adds accommodation allowance fields separate from DSA

-- Add accommodation_rate column (amount per night)
ALTER TABLE travel_requests ADD COLUMN IF NOT EXISTS accommodation_rate NUMERIC(12, 2);

-- Add accommodation_currency column (currency for accommodation rate)
ALTER TABLE travel_requests ADD COLUMN IF NOT EXISTS accommodation_currency VARCHAR(3) DEFAULT 'KES';

-- Add accommodation_amount column (total accommodation calculated)
ALTER TABLE travel_requests ADD COLUMN IF NOT EXISTS accommodation_amount NUMERIC(12, 2);

-- Add comments to document the columns
COMMENT ON COLUMN travel_requests.accommodation_rate IS 'Accommodation allowance rate per night (separate from DSA)';
COMMENT ON COLUMN travel_requests.accommodation_currency IS 'Currency for accommodation rate (e.g., KES, USD)';
COMMENT ON COLUMN travel_requests.accommodation_amount IS 'Total accommodation amount calculated (nights * rate)';
