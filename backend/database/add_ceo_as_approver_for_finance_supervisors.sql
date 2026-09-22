-- Add CEO as approver for finance officers and supervisors
-- This ensures CEO receives email notifications and can approve their travel requests

-- First, get the CEO user ID
-- Assuming CEO role is 'ceo'
DO $$
DECLARE
  ceo_id INTEGER;
BEGIN
  -- Get CEO user ID
  SELECT id INTO ceo_id FROM users WHERE role = 'ceo' LIMIT 1;
  
  IF ceo_id IS NULL THEN
    RAISE NOTICE 'No CEO found in users table';
    RETURN;
  END IF;
  
  RAISE NOTICE 'CEO ID: %', ceo_id;
  
  -- Add CEO as approver for all finance officers who don't already have CEO as approver
  INSERT INTO travel_employee_routing (employee_id, approver_id, created_at, updated_at)
  SELECT 
    u.id as employee_id,
    ceo_id as approver_id,
    NOW() as created_at,
    NOW() as updated_at
  FROM users u
  WHERE u.role = 'finance'
    AND u.is_deleted = FALSE
    AND NOT EXISTS (
      SELECT 1 FROM travel_employee_routing ter 
      WHERE ter.employee_id = u.id AND ter.approver_id = ceo_id
    );
  
  RAISE NOTICE 'Added CEO as approver for finance officers';
  
  -- Add CEO as approver for all supervisors who don't already have CEO as approver
  INSERT INTO travel_employee_routing (employee_id, approver_id, created_at, updated_at)
  SELECT 
    u.id as employee_id,
    ceo_id as approver_id,
    NOW() as created_at,
    NOW() as updated_at
  FROM users u
  WHERE u.role = 'supervisor'
    AND u.is_deleted = FALSE
    AND NOT EXISTS (
      SELECT 1 FROM travel_employee_routing ter 
      WHERE ter.employee_id = u.id AND ter.approver_id = ceo_id
    );
  
  RAISE NOTICE 'Added CEO as approver for supervisors';
  
END $$;
