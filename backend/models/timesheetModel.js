const { query } = require('../config/db');

const TABLE_NAME = 'timesheets';

const createTimesheet = async ({ userId, month, year, partners, dailyEntries }) => {
  const result = await query(
    `INSERT INTO ${TABLE_NAME} (user_id, month, year, partners, daily_entries, status) 
     VALUES ($1::BIGINT, $2::INTEGER, $3::INTEGER, $4::TEXT[], $5::JSONB, 'draft') 
     RETURNING *`,
    [userId, month, year, partners, JSON.stringify(dailyEntries)]
  );
  return result.rows[0];
};

const getTimesheet = async ({ userId, month, year }) => {
  const result = await query(
    `SELECT * FROM ${TABLE_NAME} WHERE user_id = $1::BIGINT AND month = $2::INTEGER AND year = $3::INTEGER`,
    [userId, month, year]
  );
  return result.rows[0];
};

const updateTimesheet = async (id, updates) => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  console.log('updateTimesheet called with ID:', id, 'and updates:', Object.keys(updates));

  if (updates.partners !== undefined) {
    fields.push(`partners = $${paramCount}::TEXT[]`);
    values.push(Array.isArray(updates.partners) ? updates.partners : []);
    paramCount++;
  }
  if (updates.dailyEntries !== undefined) {
    fields.push(`daily_entries = $${paramCount}::JSONB`);
    const entries = typeof updates.dailyEntries === 'object' ? JSON.stringify(updates.dailyEntries) : '{}';
    values.push(entries);
    paramCount++;
  }
  if (updates.totalHours !== undefined) {
    fields.push(`total_hours = $${paramCount}::NUMERIC(10,2)`);
    const hours = parseFloat(updates.totalHours);
    values.push(isNaN(hours) ? 0 : hours);
    paramCount++;
  }
  if (updates.levelOfEffort !== undefined) {
    fields.push(`level_of_effort = $${paramCount}::NUMERIC(5,2)`);
    const loe = parseFloat(updates.levelOfEffort);
    values.push(isNaN(loe) ? 0 : loe);
    paramCount++;
  }
  if (updates.employeeSignature !== undefined) {
    fields.push(`employee_signature = $${paramCount}::TEXT`);
    values.push(updates.employeeSignature ? String(updates.employeeSignature) : null);
    paramCount++;
  }
  if (updates.employeeSignatureDate !== undefined) {
    fields.push(`employee_signature_date = $${paramCount}::TIMESTAMPTZ`);
    values.push(updates.employeeSignatureDate || null);
    paramCount++;
  }
  if (updates.supervisorId !== undefined) {
    fields.push(`supervisor_id = $${paramCount}::BIGINT`);
    values.push(updates.supervisorId ? parseInt(updates.supervisorId) : null);
    paramCount++;
  }
  if (updates.supervisorSignature !== undefined) {
    fields.push(`supervisor_signature = $${paramCount}::TEXT`);
    values.push(updates.supervisorSignature ? String(updates.supervisorSignature) : null);
    paramCount++;
  }
  if (updates.supervisorSignatureDate !== undefined) {
    fields.push(`supervisor_signature_date = $${paramCount}::TIMESTAMPTZ`);
    values.push(updates.supervisorSignatureDate || null);
    paramCount++;
  }
  if (updates.supervisorComment !== undefined) {
    fields.push(`supervisor_comment = $${paramCount}::TEXT`);
    values.push(updates.supervisorComment ? String(updates.supervisorComment) : null);
    paramCount++;
  }
  if (updates.status !== undefined) {
    fields.push(`status = $${paramCount}::VARCHAR(20)`);
    values.push(updates.status || 'draft');
    paramCount++;
  }
  if (updates.submittedAt !== undefined) {
    fields.push(`submitted_at = $${paramCount}::TIMESTAMPTZ`);
    values.push(updates.submittedAt || null);
    paramCount++;
  }
  if (updates.approvedAt !== undefined) {
    fields.push(`approved_at = $${paramCount}::TIMESTAMPTZ`);
    values.push(updates.approvedAt || null);
    paramCount++;
  }
  if (updates.rejectedAt !== undefined) {
    fields.push(`rejected_at = $${paramCount}::TIMESTAMPTZ`);
    values.push(updates.rejectedAt || null);
    paramCount++;
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  const parsedId = parseInt(id);
  if (isNaN(parsedId)) {
    throw new Error('Invalid timesheet ID');
  }
  values.push(parsedId);

  console.log('Executing UPDATE with fields:', fields.join(', '));
  console.log('Values:', values);

  const result = await query(
    `UPDATE ${TABLE_NAME} SET ${fields.join(', ')} WHERE id = $${paramCount}::BIGINT RETURNING *`,
    values
  );
  
  console.log('Updated timesheet result:', result.rows[0]);
  return result.rows[0];
};

const listTimesheets = async ({ userId, status, month, year, supervisorId } = {}) => {
  let queryText = `SELECT t.*, u.first_name || ' ' || u.last_name as employee_name, u.position_title, 
                  s.first_name || ' ' || s.last_name as supervisor_name 
                  FROM ${TABLE_NAME} t 
                  LEFT JOIN users u ON t.user_id = u.id 
                  LEFT JOIN users s ON t.supervisor_id = s.id WHERE 1=1`;
  const params = [];
  let paramCount = 1;

  if (userId) {
    queryText += ` AND t.user_id = $${paramCount}::BIGINT`;
    params.push(parseInt(userId));
    paramCount++;
  }
  if (status) {
    queryText += ` AND t.status = $${paramCount}`;
    params.push(status);
    paramCount++;
  }
  if (month) {
    queryText += ` AND t.month = $${paramCount}::INTEGER`;
    params.push(parseInt(month));
    paramCount++;
  }
  if (year) {
    queryText += ` AND t.year = $${paramCount}::INTEGER`;
    params.push(parseInt(year));
    paramCount++;
  }
  if (supervisorId) {
    queryText += ` AND t.supervisor_id = $${paramCount}::BIGINT`;
    params.push(parseInt(supervisorId));
    paramCount++;
  }

  queryText += ` ORDER BY t.year DESC, t.month DESC, t.created_at DESC`;

  const result = await query(queryText, params);
  return result.rows;
};

const deleteTimesheet = async (id) => {
  const result = await query(`DELETE FROM ${TABLE_NAME} WHERE id = $1 RETURNING *`, [id]);
  return result.rows[0];
};

module.exports = {
  createTimesheet,
  getTimesheet,
  updateTimesheet,
  deleteTimesheet,
  listTimesheets
};
