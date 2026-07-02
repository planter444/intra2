const { query } = require('../config/db');

const mapTemplate = (row, includeFile = false) => {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    version: row.version,
    fileName: row.file_name,
    fieldMap: row.field_map || {},
    isActive: row.is_active,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    ...(includeFile ? { fileData: row.file_data } : {})
  };
};

const mapPayslip = (row, includePdf = false) => {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    period: row.period,
    templateId: row.template_id,
    data: row.data || {},
    generatedBy: row.generated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    employeeName: row.first_name ? `${row.first_name} ${row.last_name}` : undefined,
    employeeNo: row.employee_no,
    departmentName: row.department_name,
    ...(includePdf ? { pdfData: row.pdf_data } : {})
  };
};

const mapProfile = (row) => {
  if (!row) {
    return null;
  }
  return {
    userId: row.user_id,
    idNumber: row.id_number || '',
    kraPin: row.kra_pin || '',
    nssfNumber: row.nssf_number || '',
    shifNumber: row.shif_number || '',
    paymentMode: row.payment_mode || 'Bank Transfer',
    grossSalary: Number(row.gross_salary) || 0,
    allowances: Number(row.allowances) || 0,
    bonuses: Number(row.bonuses) || 0,
    overtime: Number(row.overtime) || 0,
    gratuity: Number(row.gratuity) || 0,
    paye: Number(row.paye) || 0,
    nssf: Number(row.nssf) || 0,
    shif: Number(row.shif) || 0,
    housingLevy: Number(row.housing_levy) || 0,
    pension: Number(row.pension) || 0,
    otherDeductions: Number(row.other_deductions) || 0,
    personalRelief: Number(row.personal_relief) || 0,
    insuranceRelief: Number(row.insurance_relief) || 0,
    otherContributions: Array.isArray(row.other_contributions) ? row.other_contributions : []
  };
};

const listTemplates = async () => {
  const result = await query(
    'SELECT id, version, file_name, field_map, is_active, uploaded_by, created_at FROM payslip_templates ORDER BY version DESC'
  );
  return result.rows.map((row) => mapTemplate(row));
};

const getTemplateById = async (id) => {
  const result = await query('SELECT * FROM payslip_templates WHERE id = $1 LIMIT 1', [id]);
  return mapTemplate(result.rows[0], true);
};

const getActiveTemplate = async () => {
  const result = await query('SELECT * FROM payslip_templates WHERE is_active = TRUE ORDER BY version DESC LIMIT 1');
  return mapTemplate(result.rows[0], true);
};

const createTemplate = async ({ fileName, fileData, fieldMap, uploadedBy }) => {
  const versionResult = await query('SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM payslip_templates');
  const version = versionResult.rows[0].next_version;
  await query('UPDATE payslip_templates SET is_active = FALSE');
  const result = await query(
    `INSERT INTO payslip_templates (version, file_name, file_data, field_map, is_active, uploaded_by)
     VALUES ($1, $2, $3, $4, TRUE, $5)
     RETURNING id, version, file_name, field_map, is_active, uploaded_by, created_at`,
    [version, fileName, fileData, JSON.stringify(fieldMap || {}), uploadedBy]
  );
  return mapTemplate(result.rows[0]);
};

const activateTemplate = async (id) => {
  await query('UPDATE payslip_templates SET is_active = FALSE');
  const result = await query(
    'UPDATE payslip_templates SET is_active = TRUE WHERE id = $1 RETURNING id, version, file_name, field_map, is_active, uploaded_by, created_at',
    [id]
  );
  return mapTemplate(result.rows[0]);
};

const updateTemplateFieldMap = async (id, fieldMap) => {
  const result = await query(
    'UPDATE payslip_templates SET field_map = $2 WHERE id = $1 RETURNING id, version, file_name, field_map, is_active, uploaded_by, created_at',
    [id, JSON.stringify(fieldMap || {})]
  );
  return mapTemplate(result.rows[0]);
};

const upsertPayslip = async ({ userId, period, templateId, data, pdfData, generatedBy }) => {
  const result = await query(
    `INSERT INTO payslips (user_id, period, template_id, data, pdf_data, generated_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, period)
     DO UPDATE SET template_id = EXCLUDED.template_id, data = EXCLUDED.data, pdf_data = EXCLUDED.pdf_data,
                   generated_by = EXCLUDED.generated_by, updated_at = NOW()
     RETURNING id, user_id, period, template_id, data, generated_by, created_at, updated_at`,
    [userId, period, templateId, JSON.stringify(data || {}), pdfData, generatedBy]
  );
  return mapPayslip(result.rows[0]);
};

const listPayslips = async ({ userId, period } = {}) => {
  const clauses = [];
  const params = [];
  if (userId) {
    params.push(userId);
    clauses.push(`p.user_id = $${params.length}`);
  }
  if (period) {
    params.push(period);
    clauses.push(`p.period = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query(
    `SELECT p.id, p.user_id, p.period, p.template_id, p.data, p.generated_by, p.created_at, p.updated_at,
            u.first_name, u.last_name, u.employee_no, d.name AS department_name
     FROM payslips p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN departments d ON d.id = u.department_id
     ${where}
     ORDER BY p.period DESC, u.first_name ASC`,
    params
  );
  return result.rows.map((row) => mapPayslip(row));
};

const getPayslipById = async (id) => {
  const result = await query(
    `SELECT p.*, u.first_name, u.last_name, u.employee_no, d.name AS department_name
     FROM payslips p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE p.id = $1 LIMIT 1`,
    [id]
  );
  return mapPayslip(result.rows[0], true);
};

const getProfileByUserId = async (userId) => {
  const result = await query('SELECT * FROM payroll_profiles WHERE user_id = $1 LIMIT 1', [userId]);
  return mapProfile(result.rows[0]);
};

const upsertProfile = async (userId, profile) => {
  const result = await query(
    `INSERT INTO payroll_profiles (
       user_id, id_number, kra_pin, nssf_number, shif_number, payment_mode,
       gross_salary, allowances, bonuses, overtime, gratuity,
       paye, nssf, shif, housing_levy, pension, other_deductions,
       personal_relief, insurance_relief, other_contributions
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
     ON CONFLICT (user_id) DO UPDATE SET
       id_number = EXCLUDED.id_number,
       kra_pin = EXCLUDED.kra_pin,
       nssf_number = EXCLUDED.nssf_number,
       shif_number = EXCLUDED.shif_number,
       payment_mode = EXCLUDED.payment_mode,
       gross_salary = EXCLUDED.gross_salary,
       allowances = EXCLUDED.allowances,
       bonuses = EXCLUDED.bonuses,
       overtime = EXCLUDED.overtime,
       gratuity = EXCLUDED.gratuity,
       paye = EXCLUDED.paye,
       nssf = EXCLUDED.nssf,
       shif = EXCLUDED.shif,
       housing_levy = EXCLUDED.housing_levy,
       pension = EXCLUDED.pension,
       other_deductions = EXCLUDED.other_deductions,
       personal_relief = EXCLUDED.personal_relief,
       insurance_relief = EXCLUDED.insurance_relief,
       other_contributions = EXCLUDED.other_contributions,
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      profile.idNumber || null,
      profile.kraPin || null,
      profile.nssfNumber || null,
      profile.shifNumber || null,
      profile.paymentMode || 'Bank Transfer',
      profile.grossSalary || 0,
      profile.allowances || 0,
      profile.bonuses || 0,
      profile.overtime || 0,
      profile.gratuity || 0,
      profile.paye || 0,
      profile.nssf || 0,
      profile.shif || 0,
      profile.housingLevy || 0,
      profile.pension || 0,
      profile.otherDeductions || 0,
      profile.personalRelief || 0,
      profile.insuranceRelief || 0,
      JSON.stringify(profile.otherContributions || [])
    ]
  );
  return mapProfile(result.rows[0]);
};

module.exports = {
  listTemplates,
  getTemplateById,
  getActiveTemplate,
  createTemplate,
  activateTemplate,
  updateTemplateFieldMap,
  upsertPayslip,
  listPayslips,
  getPayslipById,
  getProfileByUserId,
  upsertProfile
};
