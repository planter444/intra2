-- Update existing pending requests to pending_ceo where CEO is the first approver
-- This fixes requests created before the routing was set up

DO $$
DECLARE
  ceo_id INTEGER;
  updated_count INTEGER;
BEGIN
  -- Get CEO user ID
  SELECT id INTO ceo_id FROM users WHERE role = 'ceo' LIMIT 1;
  
  IF ceo_id IS NULL THEN
    RAISE NOTICE 'No CEO found in users table';
    RETURN;
  END IF;
  
  RAISE NOTICE 'CEO ID: %', ceo_id;
  
  -- Update pending requests where CEO is the first approver in routing
  UPDATE travel_requests tr
  SET status = 'pending_ceo'
  WHERE tr.status = 'pending'
    AND tr.user_id IN (
      SELECT DISTINCT ter.employee_id
      FROM travel_employee_routing ter
      WHERE ter.approver_id = ceo_id
        AND ter.employee_id = (
          SELECT ter2.employee_id
          FROM travel_employee_routing ter2
          WHERE ter2.employee_id = tr.user_id
          ORDER BY ter2.id
          LIMIT 1
        )
    );
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % travel requests to pending_ceo status', updated_count;
  
END $$;
