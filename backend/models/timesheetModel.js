const { query } = require('../config/db');

const TABLE_NAME = 'timesheets';

const createTimesheet = async ({ userId, month, year, partners, dailyEntries }) => {
  const result = await query(
    `INSERT INTO ${TABLE_NAME} (user_id, month, year, partners, daily_entries) 
     VALUES ($1, $2, $3, $4, $5) 
     RETURNING *`,
    [userId, month, year, partners, JSON.stringify(dailyEntries)]
  );
  return result.rows[0];
};

const getTimesheet = async ({ userId, month, year }) => {
  const result = await query(
    `SELECT * FROM ${TABLE_NAME} WHERE user_id = $1 AND month = $2 AND year = $3`,
    [userId, month, year]
  );
  return result.rows[0];
};

const updateTimesheet = async (id, updates) => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  if (updates.partners !== undefined) {
    fields.push(`partners = $${paramCount}`);
    values.push(updates.partners);
    paramCount++;
  }
  if (updates.dailyEntries !== undefined) {
    fields.push(`daily_entries = $${paramCount}`);
    values.push(JSON.stringify(updates.dailyEntries));
    paramCount++;
  }
  if (updates.totalHours !== undefined) {
    fields.push(`total_hours = $${paramCount}`);
    values.push(updates.totalHours);
    paramCount++;
  }
  if (updates.levelOfEffort !== undefined) {
    fields.push(`level_of_effort = $${paramCount}`);
    values.push(updates.levelOfEffort);
    paramCount++;
  }
  if (updates.employeeSignature !== undefined) {
    fields.push(`employee_signature = $${paramCount}`);
    values.push(updates.employeeSignature);
    paramCount++;
  }
  if (updates.employeeSignatureDate !== undefined) {
    fields.push(`employee_signature_date = $${paramCount}`);
    values.push(updates.employeeSignatureDate);
    paramCount++;
  }
  if (updates.supervisorId !== undefined) {
    fields.push(`supervisor_id = $${paramCount}`);
    values.push(updates.supervisorId);
    paramCount++;
  }
  if (updates.supervisorSignature !== undefined) {
    fields.push(`supervisor_signature = $${paramCount}`);
    values.push(updates.supervisorSignature);
    paramCount++;
  }
  if (updates.supervisorSignatureDate !== undefined) {
    fields.push(`supervisor_signature_date = $${paramCount}`);
    values.push(updates.supervisorSignatureDate);
    paramCount++;
  }
  if (updates.supervisorComment !== undefined) {
    fields.push(`supervisor_comment = $${paramCount}`);
    values.push(updates.supervisorComment);
    paramCount++;
  }
  if (updates.status !== undefined) {
    fields.push(`status = $${paramCount}`);
    values.push(updates.status);
    paramCount++;
  }
  if (updates.submittedAt !== undefined) {
    fields.push(`submitted_at = $${paramCount}`);
    values.push(updates.submittedAt);
    paramCount++;
  }
  if (updates.approvedAt !== undefined) {
    fields.push(`approved_at = $${paramCount}`);
    values.push(updates.approvedAt);
    paramCount++;
  }
  if (updates.rejectedAt !== undefined) {
    fields.push(`rejected_at = $${paramCount}`);
    values.push(updates.rejectedAt);
    paramCount++;
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);
  paramCount++;

  const result = await query(
    `UPDATE ${TABLE_NAME} SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );
  return result.rows[0];
};

const listTimesheets = async ({ userId, status, month, year, supervisorId } = {}) => {
  let queryText = `SELECT t.*, u.full_name as employee_name, u.position_title, 
                  s.full_name as supervisor_name 
                  FROM ${TABLE_NAME} t 
                  JOIN users u ON t.user_id = u.id 
                  LEFT JOIN users s ON t.supervisor_id = s.id WHERE 1=1`;
  const params = [];
  let paramCount = 1;

  if (userId) {
    queryText += ` AND t.user_id = $${paramCount}`;
    params.push(userId);
    paramCount++;
  }
  if (status) {
    queryText += ` AND t.status = $${paramCount}`;
    params.push(status);
    paramCount++;
  }
  if (month) {
    queryText += ` AND t.month = $${paramCount}`;
    params.push(month);
    paramCount++;
  }
  if (year) {
    queryText += ` AND t.year = $${paramCount}`;
    params.push(year);
    paramCount++;
  }
  if (supervisorId) {
    queryText += ` AND t.supervisor_id = $${paramCount}`;
    params.push(supervisorId);
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
  createTimesheetTable,
  createTimesheet,
  getTimesheet,
  updateTimesheet,
  listTimesheets,
  deleteTimesheet
};
