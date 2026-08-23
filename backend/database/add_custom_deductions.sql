-- Add custom_deductions column to payroll_profiles table
ALTER TABLE payroll_profiles ADD COLUMN IF NOT EXISTS custom_deductions JSONB NOT NULL DEFAULT '[]'::jsonb;
