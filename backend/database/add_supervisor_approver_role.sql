-- Add supervisor_approver_role column to leave_requests table
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS supervisor_approver_role VARCHAR(50);

-- Update existing records to populate supervisor_approver_role from users table
-- Use role_title for proper display names (e.g., "Chairman", "Chairperson")
UPDATE leave_requests lr
SET supervisor_approver_role = COALESCE(u.role_title, u.role)
FROM users u
WHERE lr.supervisor_approver_id = u.id AND lr.supervisor_approver_role IS NULL;
