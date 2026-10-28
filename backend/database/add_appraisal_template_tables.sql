-- Appraisal Template System Tables
-- Supports template-based appraisal (KPI Setup Two)

-- Template storage table
CREATE TABLE IF NOT EXISTS appraisal_templates (
  id SERIAL PRIMARY KEY,
  template_name VARCHAR(255) NOT NULL,
  description TEXT,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50) NOT NULL, -- 'pdf' or 'docx'
  file_size INTEGER,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  version VARCHAR(50) DEFAULT '1.0',
  organization_id INTEGER DEFAULT 1
);

-- Parsed sections from templates
CREATE TABLE IF NOT EXISTS appraisal_sections (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES appraisal_templates(id) ON DELETE CASCADE,
  section_name VARCHAR(255) NOT NULL,
  section_order INTEGER NOT NULL,
  section_type VARCHAR(50), -- 'kpi', 'competency', 'assessment', 'acknowledgement', etc.
  section_weight DECIMAL(5,2), -- e.g., 60 for KPI section, 40 for competency
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fillable fields within sections
CREATE TABLE IF NOT EXISTS appraisal_fields (
  id SERIAL PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES appraisal_sections(id) ON DELETE CASCADE,
  field_name VARCHAR(255) NOT NULL,
  field_label VARCHAR(255) NOT NULL,
  field_type VARCHAR(50) NOT NULL, -- 'text', 'textarea', 'number', 'rating', 'checkbox', 'table', 'signature'
  field_order INTEGER NOT NULL,
  is_required BOOLEAN DEFAULT false,
  placeholder TEXT,
  options JSONB, -- For dropdowns, radio buttons, etc.
  validation_rules JSONB, -- e.g., {"min": 1, "max": 5} for ratings
  default_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appraisal submissions (filled forms)
CREATE TABLE IF NOT EXISTS appraisal_submissions (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES appraisal_templates(id),
  employee_id INTEGER NOT NULL REFERENCES users(id),
  supervisor_id INTEGER REFERENCES users(id),
  ceo_id INTEGER REFERENCES users(id),
  period VARCHAR(100), -- e.g., 'Q1 2026', 'Annual 2026'
  period_type VARCHAR(50), -- 'monthly', 'quarterly', 'half-yearly', 'yearly'
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'submitted', 'supervisor_review', 'ceo_review', 'completed', 'locked'
  submitted_at TIMESTAMP,
  supervisor_reviewed_at TIMESTAMP,
  ceo_reviewed_at TIMESTAMP,
  locked_at TIMESTAMP,
  locked_by INTEGER REFERENCES users(id),
  total_score DECIMAL(5,2),
  weighted_score DECIMAL(5,2),
  overall_rating VARCHAR(50), -- 'outstanding', 'exceeds', 'meets', 'needs_improvement', 'unsatisfactory'
  employee_comments TEXT,
  supervisor_comments TEXT,
  ceo_comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Filled field values for submissions
CREATE TABLE IF NOT EXISTS appraisal_field_values (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES appraisal_submissions(id) ON DELETE CASCADE,
  field_id INTEGER NOT NULL REFERENCES appraisal_fields(id),
  value TEXT,
  number_value DECIMAL(10,2),
  rating_value INTEGER,
  filled_by INTEGER REFERENCES users(id),
  filled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(submission_id, field_id)
);

-- Signature storage for appraisals
CREATE TABLE IF NOT EXISTS appraisal_signatures (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES appraisal_submissions(id) ON DELETE CASCADE,
  signer_role VARCHAR(50) NOT NULL, -- 'employee', 'supervisor', 'ceo'
  signer_id INTEGER REFERENCES users(id),
  signature_path VARCHAR(500),
  signed_at TIMESTAMP,
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appraisal_templates_active ON appraisal_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_appraisal_templates_uploaded_by ON appraisal_templates(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_appraisal_sections_template ON appraisal_sections(template_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_fields_section ON appraisal_fields(section_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_submissions_employee ON appraisal_submissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_submissions_template ON appraisal_submissions(template_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_submissions_status ON appraisal_submissions(status);
CREATE INDEX IF NOT EXISTS idx_appraisal_submissions_period ON appraisal_submissions(period);
CREATE INDEX IF NOT EXISTS idx_appraisal_field_values_submission ON appraisal_field_values(submission_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_signatures_submission ON appraisal_signatures(submission_id);

-- Comments
COMMENT ON TABLE appraisal_templates IS 'Stores uploaded appraisal templates (PDF/DOCX)';
COMMENT ON TABLE appraisal_sections IS 'Stores parsed sections from appraisal templates';
COMMENT ON TABLE appraisal_fields IS 'Stores fillable fields within appraisal sections';
COMMENT ON TABLE appraisal_submissions IS 'Stores filled appraisal submissions';
COMMENT ON TABLE appraisal_field_values IS 'Stores filled values for appraisal fields';
COMMENT ON TABLE appraisal_signatures IS 'Stores digital signatures for appraisals';
