const { query } = require('../config/db');

const formatDateOnly = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
};

const mapLeaveType = (row) => ({
  id: row.id,
  code: row.code,
  label: row.label,
  defaultDays: Number(row.default_days),
  requiresCeoApproval: row.requires_ceo_approval,
  isPaid: row.is_paid,
  requiresDocument: row.requires_document,
  canCarryForward: row.can_carry_forward,
  isActive: row.is_active
});

const listLeaveTypes = async () => {
  const result = await query(
    `SELECT id, code, label, default_days, requires_ceo_approval, is_paid, requires_document, can_carry_forward, is_active FROM leave_types WHERE is_active = TRUE ORDER BY label ASC`
  );

  return result.rows.map(mapLeaveType);
};

const findLeaveTypeByCode = async (code) => {
  const result = await query(`SELECT * FROM leave_types WHERE code = $1 AND is_active = TRUE LIMIT 1`, [code]);
  return result.rows[0] ? mapLeaveType(result.rows[0]) : null;
};

const syncLeaveTypes = async (leaveTypes) => {
  await query(`UPDATE leave_types SET is_active = FALSE, updated_at = NOW()`);

  for (const leaveType of leaveTypes) {
    await query(
      `
        INSERT INTO leave_types (code, label, default_days, requires_ceo_approval, is_paid, requires_document, can_carry_forward, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
        ON CONFLICT (code)
        DO UPDATE SET
          label = EXCLUDED.label,
          default_days = EXCLUDED.default_days,
          requires_ceo_approval = EXCLUDED.requires_ceo_approval,
          is_paid = EXCLUDED.is_paid,
          requires_document = EXCLUDED.requires_document,
          can_carry_forward = EXCLUDED.can_carry_forward,
          is_active = TRUE,
          updated_at = NOW()
      `,
      [
        leaveType.code,
        leaveType.label,
        leaveType.defaultDays,
        leaveType.requiresCeoApproval || false,
        leaveType.isPaid !== false,
        leaveType.requiresDocument || false,
        leaveType.canCarryForward || false
      ]
    );
  }

  await ensureLeaveBalancesForAllUsers();

  return listLeaveTypes();
};

const ensureLeaveBalancesForAllUsers = async () => {
  await query(
    `
      INSERT INTO leave_balances (user_id, leave_type_id, balance_days)
      SELECT u.id, lt.id, lt.default_days
      FROM users u
      CROSS JOIN leave_types lt
      WHERE u.is_deleted = FALSE
        AND lt.is_active = TRUE
      ON CONFLICT (user_id, leave_type_id)
      DO NOTHING
    `
  );

  await query(
    `
      UPDATE leave_balances lb
      SET
        balance_days = GREATEST(lt.default_days - lb.used_days, 0),
        updated_at = NOW()
      FROM leave_types lt
      WHERE lb.leave_type_id = lt.id
        AND lt.is_active = TRUE
    `
  );
};

const getBalancesForUser = async (userId) => {
  const result = await query(
    `
      SELECT
        lb.id,
        lb.user_id,
        lb.leave_type_id,
        lb.balance_days,
        lb.used_days,
        lt.code,
        lt.label,
        lt.default_days,
        lt.requires_ceo_approval,
        lt.is_paid,
        lt.requires_document,
        lt.can_carry_forward
      FROM leave_balances lb
      INNER JOIN leave_types lt ON lt.id = lb.leave_type_id
      WHERE lb.user_id = $1 AND lt.is_active = TRUE
      ORDER BY lt.label ASC
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    leaveTypeId: row.leave_type_id,
    code: row.code,
    label: row.label,
    defaultDays: Number(row.default_days),
    requiresCeoApproval: row.requires_ceo_approval,
    isPaid: row.is_paid,
    requiresDocument: row.requires_document,
    canCarryForward: row.can_carry_forward,
    balanceDays: Number(row.balance_days),
    usedDays: Number(row.used_days)
  }));
};

const createRequest = async ({ userId, leaveTypeId, startDate, endDate, daysRequested, reason, status, requiresSupervisorReview, supervisorApproverId, supportingDocumentName, supportingDocumentStoredName, supportingDocumentMimeType, supportingDocumentSize, supportingDocumentPath }) => {
  const result = await query(
    `
      INSERT INTO leave_requests (
        user_id,
        leave_type_id,
        start_date,
        end_date,
        days_requested,
        reason,
        status,
        requires_supervisor_review,
        supervisor_approver_id,
        supporting_document_name,
        supporting_document_stored_name,
        supporting_document_mime_type,
        supporting_document_size,
        supporting_document_path
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `,
    [
      userId,
      leaveTypeId,
      startDate,
      endDate,
      daysRequested,
      reason,
      status,
      requiresSupervisorReview || false,
      supervisorApproverId || null,
      supportingDocumentName || null,
      supportingDocumentStoredName || null,
      supportingDocumentMimeType || null,
      supportingDocumentSize || null,
      supportingDocumentPath || null
    ]
  );

  return findRequestById(result.rows[0].id);
};

const findRequestById = async (id) => {
  const result = await query(
    `
      SELECT
        lr.*,
        lt.code,
        lt.label,
        lt.requires_ceo_approval,
        u.first_name,
        u.last_name,
        u.employee_no,
        u.email,
        u.phone,
        u.position_title,
        u.department_id,
        u.supervisor_id AS employee_supervisor_id,
        d.name AS department_name,
        supervisor.first_name AS supervisor_first_name,
        supervisor.last_name AS supervisor_last_name,
        supervisor.role AS supervisor_role,
        hr.first_name AS hr_first_name,
        hr.last_name AS hr_last_name,
        ceo.first_name AS ceo_first_name,
        ceo.last_name AS ceo_last_name
      FROM leave_requests lr
      INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
      INNER JOIN users u ON u.id = lr.user_id AND u.is_deleted = FALSE
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN users supervisor ON supervisor.id = lr.supervisor_approver_id
      LEFT JOIN users hr ON hr.id = lr.hr_approver_id
      LEFT JOIN users ceo ON ceo.id = lr.ceo_approver_id
      WHERE lr.id = $1
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
    leaveTypeId: row.leave_type_id,
    leaveTypeCode: row.code,
    leaveTypeLabel: row.label,
    requiresCeoApproval: row.requires_ceo_approval,
    employeeName: `${row.first_name} ${row.last_name}`,
    employeeNo: row.employee_no,
    employeeEmail: row.email,
    employeePhone: row.phone,
    employeePositionTitle: row.position_title,
    employeeDepartmentId: row.department_id,
    employeeSupervisorId: row.employee_supervisor_id,
    employeeDepartmentName: row.department_name,
    startDate: formatDateOnly(row.start_date),
    endDate: formatDateOnly(row.end_date),
    daysRequested: Number(row.days_requested),
    reason: row.reason,
    supportingDocumentName: row.supporting_document_name,
    supportingDocumentStoredName: row.supporting_document_stored_name,
    supportingDocumentMimeType: row.supporting_document_mime_type,
    supportingDocumentSize: row.supporting_document_size ? Number(row.supporting_document_size) : null,
    supportingDocumentPath: row.supporting_document_path,
    status: row.status,
    requiresSupervisorReview: row.requires_supervisor_review,
    supervisorApproverId: row.supervisor_approver_id,
    supervisorApproverRole: row.supervisor_role,
    hrApproverId: row.hr_approver_id,
    ceoApproverId: row.ceo_approver_id,
    supervisorComment: row.supervisor_comment,
    hrComment: row.hr_comment,
    ceoComment: row.ceo_comment,
    supervisorApproverName: row.supervisor_first_name ? `${row.supervisor_first_name} ${row.supervisor_last_name}` : null,
    hrApproverName: row.hr_first_name ? `${row.hr_first_name} ${row.hr_last_name}` : null,
    ceoApproverName: row.ceo_first_name ? `${row.ceo_first_name} ${row.ceo_last_name}` : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const listRequests = async ({ viewerId, userId, role, status } = {}) => {
  const clauses = [];
  const params = [];

  if (role === 'employee') {
    params.push(viewerId);
    clauses.push(`lr.user_id = $${params.length}`);
  }

  if (role === 'supervisor') {
    params.push(viewerId);
    clauses.push(`(
      lr.user_id = $${params.length}
      OR lr.user_id IN (
        SELECT id
        FROM users
        WHERE supervisor_id = $${params.length}
          AND is_deleted = FALSE
      )
    )`);
  }

  clauses.push(`lr.status <> 'cancelled'`);

  if (userId && role !== 'employee') {
    params.push(userId);
    clauses.push(`lr.user_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    clauses.push(`lr.status = $${params.length}`);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query(
    `
      SELECT
        lr.id
      FROM leave_requests lr
      INNER JOIN users request_user ON request_user.id = lr.user_id AND request_user.is_deleted = FALSE
      ${whereClause}
      ORDER BY lr.created_at DESC
    `,
    params
  );

  const requests = [];
  for (const row of result.rows) {
    requests.push(await findRequestById(row.id));
  }
  return requests;
};

const listApprovedRequestsInRange = async ({ startDate, endDate }) => {
  const result = await query(
    `
      SELECT
        lr.id,
        lr.user_id,
        lr.leave_type_id,
        lr.start_date,
        lr.end_date,
        lr.days_requested,
        lr.reason,
        lr.status,
        lr.created_at,
        lr.updated_at,
        lt.code,
        lt.label,
        u.first_name,
        u.last_name,
        u.employee_no,
        u.email,
        u.position_title,
        u.department_id,
        d.name AS department_name
      FROM leave_requests lr
      INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
      INNER JOIN users u ON u.id = lr.user_id AND u.is_deleted = FALSE
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE lr.status = 'approved'
        AND lr.start_date <= $2
        AND lr.end_date >= $1
      ORDER BY lr.start_date ASC, lr.created_at ASC
    `,
    [startDate, endDate]
  );

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    leaveTypeId: row.leave_type_id,
    leaveTypeCode: row.code,
    leaveTypeLabel: row.label,
    employeeName: `${row.first_name} ${row.last_name}`,
    employeeNo: row.employee_no,
    employeeEmail: row.email,
    employeePositionTitle: row.position_title,
    employeeDepartmentId: row.department_id,
    employeeDepartmentName: row.department_name,
    startDate: formatDateOnly(row.start_date),
    endDate: formatDateOnly(row.end_date),
    daysRequested: Number(row.days_requested),
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
};

const updateRequestStatus = async ({ id, status, supervisorApproverId, hrApproverId, ceoApproverId, supervisorComment, hrComment, ceoComment }) => {
  await query(
    `
      UPDATE leave_requests
      SET
        status = COALESCE($2, status),
        supervisor_approver_id = COALESCE($3, supervisor_approver_id),
        hr_approver_id = COALESCE($4, hr_approver_id),
        ceo_approver_id = COALESCE($5, ceo_approver_id),
        supervisor_comment = COALESCE($6, supervisor_comment),
        hr_comment = COALESCE($7, hr_comment),
        ceo_comment = COALESCE($8, ceo_comment),
        updated_at = NOW()
      WHERE id = $1
    `,
    [id, status, supervisorApproverId, hrApproverId, ceoApproverId, supervisorComment, hrComment, ceoComment]
  );

  return findRequestById(id);
};

const updateRequestDetails = async ({
  id,
  leaveTypeId,
  startDate,
  endDate,
  daysRequested,
  reason,
  status,
  requiresSupervisorReview,
  supervisorApproverId,
  supportingDocumentName,
  supportingDocumentStoredName,
  supportingDocumentMimeType,
  supportingDocumentSize,
  supportingDocumentPath
}) => {
  await query(
    `
      UPDATE leave_requests
      SET
        leave_type_id = COALESCE($2, leave_type_id),
        start_date = COALESCE($3, start_date),
        end_date = COALESCE($4, end_date),
        days_requested = COALESCE($5, days_requested),
        reason = COALESCE($6, reason),
        status = COALESCE($7, status),
        requires_supervisor_review = COALESCE($8, requires_supervisor_review),
        supervisor_approver_id = COALESCE($9, supervisor_approver_id),
        supporting_document_name = COALESCE($10, supporting_document_name),
        supporting_document_stored_name = COALESCE($11, supporting_document_stored_name),
        supporting_document_mime_type = COALESCE($12, supporting_document_mime_type),
        supporting_document_size = COALESCE($13, supporting_document_size),
        supporting_document_path = COALESCE($14, supporting_document_path),
        updated_at = NOW()
      WHERE id = $1
    `,
    [
      id,
      leaveTypeId,
      startDate,
      endDate,
      daysRequested,
      reason,
      status,
      requiresSupervisorReview,
      supervisorApproverId,
      supportingDocumentName,
      supportingDocumentStoredName,
      supportingDocumentMimeType,
      supportingDocumentSize,
      supportingDocumentPath
    ]
  );

  return findRequestById(id);
};

const cancelRequest = async (id) => updateRequestStatus({ id, status: 'cancelled' });

const applyApprovedDaysToBalance = async ({ userId, leaveTypeId, daysRequested }) => {
  await query(
    `
      UPDATE leave_balances
      SET
        balance_days = balance_days - $3,
        used_days = used_days + $3,
        updated_at = NOW()
      WHERE user_id = $1 AND leave_type_id = $2
    `,
    [userId, leaveTypeId, daysRequested]
  );
};

const revertApprovedDaysToBalance = async ({ userId, leaveTypeId, daysRequested }) => {
  await query(
    `
      UPDATE leave_balances
      SET
        balance_days = balance_days + $3,
        used_days = GREATEST(used_days - $3, 0),
        updated_at = NOW()
      WHERE user_id = $1 AND leave_type_id = $2
    `,
    [userId, leaveTypeId, daysRequested]
  );
};

const listRequestsForUserCleanup = async (userId) => {
  const result = await query(
    `
      SELECT id, supporting_document_stored_name, supporting_document_mime_type, supporting_document_path
      FROM leave_requests
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    supportingDocumentStoredName: row.supporting_document_stored_name,
    supportingDocumentMimeType: row.supporting_document_mime_type,
    supportingDocumentPath: row.supporting_document_path
  }));
};

const deleteRequest = async (id) => {
  await query(`DELETE FROM leave_requests WHERE id = $1`, [id]);
};

const getSummaryStats = async () => {
  const [pendingLeaves, approvedLeaves] = await Promise.all([
    query(
      `
        SELECT COUNT(*)::int AS total
        FROM leave_requests lr
        INNER JOIN users u ON u.id = lr.user_id AND u.is_deleted = FALSE
        WHERE lr.status IN ('pending_supervisor', 'pending_hr', 'pending_ceo')
      `
    ),
    query(
      `
        SELECT COUNT(*)::int AS total
        FROM leave_requests lr
        INNER JOIN users u ON u.id = lr.user_id AND u.is_deleted = FALSE
        WHERE lr.status = 'approved'
      `
    )
  ]);

  return {
    pendingLeaves: pendingLeaves.rows[0]?.total || 0,
    approvedLeaves: approvedLeaves.rows[0]?.total || 0
  };
};

const getSummaryStatsForUser = async (userId) => {
  const [pendingLeaves, approvedLeaves] = await Promise.all([
    query(
      `
        SELECT COUNT(*)::int AS total
        FROM leave_requests lr
        INNER JOIN users u ON u.id = lr.user_id AND u.is_deleted = FALSE
        WHERE lr.user_id = $1
          AND lr.status IN ('pending_supervisor', 'pending_hr', 'pending_ceo')
      `,
      [userId]
    ),
    query(
      `
        SELECT COUNT(*)::int AS total
        FROM leave_requests lr
        INNER JOIN users u ON u.id = lr.user_id AND u.is_deleted = FALSE
        WHERE lr.user_id = $1
          AND lr.status = 'approved'
      `,
      [userId]
    )
  ]);

  return {
    pendingLeaves: pendingLeaves.rows[0]?.total || 0,
    approvedLeaves: approvedLeaves.rows[0]?.total || 0
  };
};

module.exports = {
  listLeaveTypes,
  findLeaveTypeByCode,
  syncLeaveTypes,
  ensureLeaveBalancesForAllUsers,
  getBalancesForUser,
  createRequest,
  findRequestById,
  listRequests,
  listApprovedRequestsInRange,
  updateRequestStatus,
  updateRequestDetails,
  listRequestsForUserCleanup,
  deleteRequest,
  cancelRequest,
  applyApprovedDaysToBalance,
  revertApprovedDaysToBalance,
  getSummaryStats,
  getSummaryStatsForUser
};
