const { query } = require('../config/db');

const create = async ({ userId, uploadedBy, folderType, fileName, storedName, mimeType, fileSize, storagePath }) => {
  const result = await query(
    `
      INSERT INTO documents (
        user_id,
        uploaded_by,
        folder_type,
        file_name,
        stored_name,
        mime_type,
        file_size,
        storage_path
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [userId, uploadedBy, folderType, fileName, storedName, mimeType, fileSize, storagePath]
  );

  return result.rows[0];
};

const findById = async (id) => {
  const result = await query(
    `
      SELECT
        d.*,
        u.first_name,
        u.last_name,
        u.employee_no
      FROM documents d
      INNER JOIN users u ON u.id = d.user_id
      WHERE d.id = $1
      LIMIT 1
    `,
    [id]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    uploadedBy: row.uploaded_by,
    folderType: row.folder_type,
    fileName: row.file_name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    storagePath: row.storage_path,
    employeeName: `${row.first_name} ${row.last_name}`,
    employeeNo: row.employee_no,
    createdAt: row.created_at
  };
};

const listVisible = async ({ viewerId, viewerRole, userId, search } = {}) => {
  const params = [];
  const clauses = [];

  if (viewerRole !== 'ceo') {
    params.push(viewerId);
    clauses.push(`d.user_id = $${params.length}`);
  } else if (userId) {
    params.push(userId);
    clauses.push(`d.user_id = $${params.length}`);
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    clauses.push(`(CONCAT(u.first_name, ' ', u.last_name) ILIKE $${params.length} OR COALESCE(u.employee_no, '') ILIKE $${params.length})`);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query(
    `
      SELECT
        d.*,
        u.first_name,
        u.last_name,
        u.employee_no
      FROM documents d
      INNER JOIN users u ON u.id = d.user_id
      ${whereClause}
      ORDER BY d.created_at DESC
    `,
    params
  );

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    uploadedBy: row.uploaded_by,
    folderType: row.folder_type,
    fileName: row.file_name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    employeeName: `${row.first_name} ${row.last_name}`,
    employeeNo: row.employee_no,
    createdAt: row.created_at
  }));
};

const listForUser = async (userId) => {
  const result = await query(
    `SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    uploadedBy: row.uploaded_by,
    folderType: row.folder_type,
    fileName: row.file_name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    storagePath: row.storage_path,
    createdAt: row.created_at
  }));
};

const deleteById = async (id) => {
  await query(`DELETE FROM documents WHERE id = $1`, [id]);
};

module.exports = {
  create,
  findById,
  listVisible,
  listForUser,
  deleteById
};
