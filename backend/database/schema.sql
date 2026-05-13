CREATE TABLE IF NOT EXISTS departments (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  employee_no VARCHAR(50),
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL,
  phone VARCHAR(40),
  role VARCHAR(20) NOT NULL CHECK (role IN ('employee', 'supervisor', 'admin', 'ceo', 'finance')),
  role_title VARCHAR(120),
  gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other')),
  department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL,
  joined_at DATE,
  position_title VARCHAR(120),
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
  id BIGSERIAL PRIMARY KEY,
  scope VARCHAR(50) UNIQUE NOT NULL DEFAULT 'global',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_types (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  default_days INTEGER NOT NULL DEFAULT 0,
  requires_ceo_approval BOOLEAN NOT NULL DEFAULT FALSE,
  is_paid BOOLEAN NOT NULL DEFAULT TRUE,
  requires_document BOOLEAN NOT NULL DEFAULT FALSE,
  can_carry_forward BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_balances (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type_id BIGINT NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  balance_days NUMERIC(8,2) NOT NULL DEFAULT 0,
  used_days NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, leave_type_id)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type_id BIGINT NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested NUMERIC(8,2) NOT NULL,
  reason TEXT,
  supporting_document_name VARCHAR(255),
  supporting_document_stored_name VARCHAR(255),
  supporting_document_mime_type VARCHAR(120),
  supporting_document_size BIGINT,
  supporting_document_path TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending_hr' CHECK (status IN ('pending_supervisor', 'pending_hr', 'pending_ceo', 'approved', 'rejected', 'cancelled')),
  requires_supervisor_review BOOLEAN NOT NULL DEFAULT FALSE,
  supervisor_approver_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  hr_approver_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ceo_approver_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  supervisor_comment TEXT,
  hr_comment TEXT,
  ceo_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  folder_type VARCHAR(30) NOT NULL CHECK (CHAR_LENGTH(TRIM(folder_type)) > 0),
  file_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  actor_role VARCHAR(20),
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80),
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS supervisor_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS role_title VARCHAR(120);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS joined_at DATE;

UPDATE users
SET role = 'ceo'
WHERE role = 'hr';

UPDATE users
SET role_title = CASE
  WHEN role = 'ceo' THEN 'CEO'
  WHEN role = 'admin' THEN 'IT Officer'
  WHEN role = 'finance' THEN 'Finance Officer'
  WHEN role = 'supervisor' THEN 'Supervisor'
  ELSE COALESCE(NULLIF(role_title, ''), 'Employee')
END
WHERE role_title IS NULL OR CHAR_LENGTH(TRIM(role_title)) = 0;

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
ADD CONSTRAINT users_role_check CHECK (role IN ('employee', 'supervisor', 'admin', 'ceo', 'finance'));

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_gender_check;

ALTER TABLE users
ADD CONSTRAINT users_gender_check CHECK (gender IN ('male', 'female', 'other') OR gender IS NULL);

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_email_key;

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_employee_no_key;

UPDATE users
SET email = CONCAT('deleted+', id, '-', EXTRACT(EPOCH FROM COALESCE(deleted_at, NOW()))::BIGINT, '@deleted.local')
WHERE is_deleted = TRUE
  AND email NOT LIKE 'deleted+%@deleted.local';

UPDATE users
SET employee_no = CONCAT('DEL-', id, '-', LPAD(MOD(EXTRACT(EPOCH FROM COALESCE(deleted_at, NOW()))::BIGINT, 100000000)::text, 8, '0'))
WHERE is_deleted = TRUE
  AND employee_no IS NOT NULL
  AND employee_no NOT LIKE 'DEL-%';

DELETE FROM documents d
USING users u
WHERE d.user_id = u.id
  AND u.is_deleted = TRUE;

DELETE FROM leave_requests lr
USING users u
WHERE lr.user_id = u.id
  AND u.is_deleted = TRUE;

DELETE FROM leave_balances lb
USING users u
WHERE lb.user_id = u.id
  AND u.is_deleted = TRUE;

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS supervisor_approver_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS supporting_document_name VARCHAR(255);

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS supporting_document_stored_name VARCHAR(255);

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS supporting_document_mime_type VARCHAR(120);

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS supporting_document_size BIGINT;

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS supporting_document_path TEXT;

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS supervisor_comment TEXT;

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS requires_supervisor_review BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE leave_requests
SET requires_supervisor_review = TRUE
WHERE status = 'pending_supervisor'
   OR supervisor_comment IS NOT NULL;

ALTER TABLE leave_requests
DROP CONSTRAINT IF EXISTS leave_requests_status_check;

ALTER TABLE leave_requests
ADD CONSTRAINT leave_requests_status_check CHECK (status IN ('pending_supervisor', 'pending_hr', 'pending_ceo', 'approved', 'rejected', 'cancelled'));

ALTER TABLE leave_types
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE leave_types
ADD COLUMN IF NOT EXISTS requires_document BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE leave_types
ADD COLUMN IF NOT EXISTS can_carry_forward BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE documents
DROP CONSTRAINT IF EXISTS documents_folder_type_check;

ALTER TABLE documents
ADD CONSTRAINT documents_folder_type_check CHECK (CHAR_LENGTH(TRIM(folder_type)) > 0);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_supervisor ON users(supervisor_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_active_unique ON users (LOWER(email)) WHERE is_deleted = FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_no_active_unique ON users (employee_no) WHERE employee_no IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_supervisor ON leave_requests(supervisor_approver_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
