-- Remove the restrictive check constraint on project_programme
-- This allows any value to be stored, so you can add new programs without changing the constraint

ALTER TABLE travel_requests
DROP CONSTRAINT IF EXISTS travel_requests_project_programme_check;
