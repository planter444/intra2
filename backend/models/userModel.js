const { query } = require('../config/db');

const normalizeDateOnly = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const matched = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (matched) {
      return matched[1];
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const baseSelect = `
  SELECT
    u.id,
    u.employee_no,
    u.first_name,
    u.last_name,
    u.email,
    u.phone,
    u.role,
    u.role_title,
    u.gender,
    u.department_id,
    u.joined_at,
    d.name AS department_name,
    u.supervisor_id,
    s.first_name AS supervisor_first_name,
    s.last_name AS supervisor_last_name,
    u.position_title,
    u.is_active,
    u.is_deleted,
    u.deleted_at,
    u.last_login_at,
    u.created_at,
    u.updated_at
  FROM users u
  LEFT JOIN departments d ON d.id = u.department_id
  LEFT JOIN users s ON s.id = u.supervisor_id
`;

const authSelect = `
  SELECT
    u.id,
    u.employee_no,
    u.first_name,
    u.last_name,
    u.email,
    u.phone,
    u.role,
    u.role_title,
    u.gender,
    u.department_id,
    u.joined_at,
    d.name AS department_name,
    u.supervisor_id,
    s.first_name AS supervisor_first_name,
    s.last_name AS supervisor_last_name,
    u.position_title,
    u.is_active,
    u.is_deleted,
    u.deleted_at,
    u.last_login_at,
    u.created_at,
    u.updated_at,
    u.password_hash
  FROM users u
  LEFT JOIN departments d ON d.id = u.department_id
  LEFT JOIN users s ON s.id = u.supervisor_id
`;

const mapUser = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    employeeNo: row.employee_no,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`,
    email: row.email,
    phone: row.phone,
    role: row.role,
    roleTitle: row.role === 'admin' ? 'IT Officer' : (row.role === 'finance' ? 'Finance Officer' : row.role_title),
    gender: row.gender,
    departmentId: row.department_id,
    joinedAt: normalizeDateOnly(row.joined_at),
    departmentName: row.department_name === 'Human Resources' ? 'Executive Office' : row.department_name,
    supervisorId: row.supervisor_id,
    supervisorName: row.supervisor_first_name ? `${row.supervisor_first_name} ${row.supervisor_last_name}` : null,
    positionTitle: row.position_title,
    isActive: row.is_active,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const findByEmail = async (email) => {
  const result = await query(
    `${authSelect} WHERE LOWER(u.email) = LOWER($1) AND u.is_deleted = FALSE ORDER BY u.created_at DESC LIMIT 1`,
    [email]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    ...mapUser(row),
    passwordHash: row.password_hash
  };
};

const findById = async (id) => {
  const result = await query(`${baseSelect} WHERE u.id = $1 LIMIT 1`, [id]);
  return mapUser(result.rows[0]);
};

const listAll = async ({ includeDeleted = false, role, departmentId, supervisorId, search } = {}) => {
  const clauses = [];
  const params = [];

  if (!includeDeleted) {
    params.push(false);
    clauses.push(`u.is_deleted = $${params.length}`);
  }

  if (role) {
    params.push(role);
    clauses.push(`u.role = $${params.length}`);
  }

  if (departmentId) {
    params.push(departmentId);
    clauses.push(`u.department_id = $${params.length}`);
  }

  if (supervisorId) {
    params.push(supervisorId);
    clauses.push(`u.supervisor_id = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(
      u.first_name ILIKE $${params.length}
      OR u.last_name ILIKE $${params.length}
      OR u.email ILIKE $${params.length}
      OR u.employee_no ILIKE $${params.length}
    )`);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query(`${baseSelect} ${whereClause} ORDER BY u.created_at DESC`, params);
  return result.rows.map(mapUser);
};

const create = async ({ employeeNo, firstName, lastName, email, phone, role, roleTitle, gender, departmentId, supervisorId, joinedAt, positionTitle, passwordHash }) => {
  const result = await query(
    `
      INSERT INTO users (
        employee_no,
        first_name,
        last_name,
        email,
        phone,
        role,
        role_title,
        gender,
        department_id,
        supervisor_id,
        joined_at,
        position_title,
        password_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `,
    [employeeNo || null, firstName, lastName, email, phone, role, roleTitle || null, gender || null, departmentId, supervisorId, joinedAt || null, positionTitle, passwordHash]
  );

  return findById(result.rows[0].id);
};

const update = async (id, payload) => {
  const fieldMap = {
    employeeNo: 'employee_no',
    firstName: 'first_name',
    lastName: 'last_name',
    email: 'email',
    phone: 'phone',
    role: 'role',
    roleTitle: 'role_title',
    gender: 'gender',
    departmentId: 'department_id',
    supervisorId: 'supervisor_id',
    joinedAt: 'joined_at',
    positionTitle: 'position_title',
    passwordHash: 'password_hash',
    isActive: 'is_active',
    lastLoginAt: 'last_login_at'
  };

  const entries = Object.entries(payload).filter(([, value]) => value !== undefined);

  if (!entries.length) {
    return findById(id);
  }

  const params = [];
  const sets = entries.map(([key, value]) => {
    params.push(value);
    return `${fieldMap[key]} = $${params.length}`;
  });

  params.push(id);
  await query(
    `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
    params
  );

  return findById(id);
};

const softDelete = async (id) => {
  await query(
    `
      UPDATE users
      SET is_deleted = TRUE, is_active = FALSE, deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `,
    [id]
  );

  return findById(id);
};

const countByRole = async () => {
  const result = await query(
    `SELECT role, COUNT(*)::int AS total FROM users WHERE is_deleted = FALSE GROUP BY role`
  );

  return result.rows.reduce((acc, row) => {
    acc[row.role] = row.total;
    return acc;
  }, {});
};

const hasDirectReports = async (id) => {
  const result = await query(
    `SELECT EXISTS(SELECT 1 FROM users WHERE supervisor_id = $1 AND is_deleted = FALSE) AS exists`,
    [id]
  );

  return result.rows[0]?.exists || false;
};

module.exports = {
  findByEmail,
  findById,
  listAll,
  create,
  update,
  softDelete,
  countByRole,
  hasDirectReports
};
