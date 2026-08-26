-- Add dsa_provided column to travel_requests table
ALTER TABLE travel_requests
ADD COLUMN IF NOT EXISTS dsa_provided BOOLEAN DEFAULT FALSE;
