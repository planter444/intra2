-- Remove unique constraint to allow multiple approvers per employee
ALTER TABLE travel_employee_routing
DROP CONSTRAINT IF EXISTS travel_employee_routing_employee_id_approver_id_key;
