const { query } = require('../config/db');

const getGlobal = async () => {
  const result = await query(`SELECT * FROM system_settings WHERE scope = 'global' LIMIT 1`);
  return result.rows[0]
    ? {
        id: result.rows[0].id,
        payload: result.rows[0].payload,
        updatedBy: result.rows[0].updated_by,
        updatedAt: result.rows[0].updated_at
      }
    : null;
};

const upsertGlobal = async (payload, updatedBy) => {
  const result = await query(
    `
      INSERT INTO system_settings (scope, payload, updated_by)
      VALUES ('global', $1, $2)
      ON CONFLICT (scope)
      DO UPDATE SET payload = EXCLUDED.payload, updated_by = EXCLUDED.updated_by, updated_at = NOW()
      RETURNING *
    `,
    [JSON.stringify(payload), updatedBy]
  );

  return result.rows[0];
};

const listDepartments = async () => {
  const result = await query(
    `SELECT id, name, description, is_active, created_at, updated_at FROM departments WHERE is_active = TRUE ORDER BY name ASC`
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
};

const syncDepartments = async (departments) => {
  await query(`UPDATE departments SET is_active = FALSE, updated_at = NOW()`);

  for (const department of departments) {
    await query(
      `
        INSERT INTO departments (name, description, is_active)
        VALUES ($1, $2, TRUE)
        ON CONFLICT (name)
        DO UPDATE SET description = EXCLUDED.description, is_active = TRUE, updated_at = NOW()
      `,
      [department.name, department.description || null]
    );
  }

  return listDepartments();
};

module.exports = {
  getGlobal,
  upsertGlobal,
  listDepartments,
  syncDepartments
};
