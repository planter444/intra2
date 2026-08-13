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

const mapTravelRequest = (row) => ({
  id: row.id,
  userId: row.user_id,
  startDate: formatDateOnly(row.start_date),
  endDate: formatDateOnly(row.end_date),
  origin: row.origin,
  destination: row.destination,
  reason: row.reason,
  estimatedCost: row.estimated_cost ? Number(row.estimated_cost) : null,
  status: row.status,
  approvedBy: row.approved_by,
  approvedAt: row.approved_at,
  rejectionReason: row.rejection_reason,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const createTravelRequest = async ({ userId, startDate, endDate, origin, destination, reason, estimatedCost }) => {
  const result = await query(
    `
      INSERT INTO travel_requests (
        user_id,
        start_date,
        end_date,
        origin,
        destination,
        reason,
        estimated_cost,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING id
    `,
    [userId, startDate, endDate, origin, destination, reason, estimatedCost || null]
  );

  return findTravelRequestById(result.rows[0].id);
};

const findTravelRequestById = async (id) => {
  const result = await query(
    `
      SELECT
        tr.*,
        u.first_name,
        u.last_name,
        u.employee_no,
        u.email,
        u.phone,
        u.position_title,
        u.department_id,
        u.supervisor_id AS employee_supervisor_id,
        d.name AS department_name,
        approver.first_name AS approver_first_name,
        approver.last_name AS approver_last_name,
        approver.role AS approver_role
      FROM travel_requests tr
      INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN users approver ON approver.id = tr.approved_by
      WHERE tr.id = $1
      LIMIT 1
    `,
    [id]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    ...mapTravelRequest(row),
    employeeName: `${row.first_name} ${row.last_name}`,
    employeeNo: row.employee_no,
    employeeEmail: row.email,
    employeePhone: row.phone,
    employeePositionTitle: row.position_title,
    employeeDepartmentId: row.department_id,
    employeeSupervisorId: row.employee_supervisor_id,
    employeeDepartmentName: row.department_name,
    approverName: row.approver_first_name ? `${row.approver_first_name} ${row.approver_last_name}` : null,
    approverRole: row.approver_role
  };
};

const listTravelRequests = async ({ viewerId, role, userId, status } = {}) => {
  const clauses = [];
  const params = [];

  if (role === 'employee') {
    params.push(viewerId);
    clauses.push(`tr.user_id = $${params.length}`);
  }

  if (role === 'supervisor') {
    params.push(viewerId);
    clauses.push(`(
      tr.user_id = $${params.length}
      OR tr.user_id IN (
        SELECT id
        FROM users
        WHERE supervisor_id = $${params.length}
          AND is_deleted = FALSE
      )
    )`);
  }

  if (userId && role !== 'employee') {
    params.push(userId);
    clauses.push(`tr.user_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    clauses.push(`tr.status = $${params.length}`);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query(
    `
      SELECT
        tr.id
      FROM travel_requests tr
      INNER JOIN users request_user ON request_user.id = tr.user_id AND request_user.is_deleted = FALSE
      ${whereClause}
      ORDER BY tr.created_at DESC
    `,
    params
  );

  const requests = [];
  for (const row of result.rows) {
    requests.push(await findTravelRequestById(row.id));
  }
  return requests;
};

const updateTravelRequestStatus = async ({ id, status, approvedBy, rejectionReason }) => {
  await query(
    `
      UPDATE travel_requests
      SET
        status = COALESCE($2, status),
        approved_by = COALESCE($3, approved_by),
        approved_at = CASE WHEN $3 IS NOT NULL THEN NOW() ELSE approved_at END,
        rejection_reason = COALESCE($4, rejection_reason),
        updated_at = NOW()
      WHERE id = $1
    `,
    [id, status, approvedBy || null, rejectionReason || null]
  );

  return findTravelRequestById(id);
};

const updateTravelRequestDetails = async ({ id, startDate, endDate, origin, destination, reason, estimatedCost }) => {
  await query(
    `
      UPDATE travel_requests
      SET
        start_date = COALESCE($2, start_date),
        end_date = COALESCE($3, end_date),
        origin = COALESCE($4, origin),
        destination = COALESCE($5, destination),
        reason = COALESCE($6, reason),
        estimated_cost = COALESCE($7, estimated_cost),
        updated_at = NOW()
      WHERE id = $1
    `,
    [id, startDate, endDate, origin, destination, reason, estimatedCost]
  );

  return findTravelRequestById(id);
};

const cancelTravelRequest = async (id) => updateTravelRequestStatus({ id, status: 'cancelled' });

const deleteTravelRequest = async (id) => {
  await query(`DELETE FROM travel_requests WHERE id = $1`, [id]);
};

const mapTravelReceipt = (row) => ({
  id: row.id,
  travelRequestId: row.travel_request_id,
  uploadedBy: row.uploaded_by,
  fileName: row.file_name,
  storedName: row.stored_name,
  mimeType: row.mime_type,
  fileSize: Number(row.file_size),
  storagePath: row.storage_path,
  amount: row.amount ? Number(row.amount) : null,
  description: row.description,
  reimbursementStatus: row.reimbursement_status,
  reviewedBy: row.reviewed_by,
  reviewedAt: row.reviewed_at,
  reviewComment: row.review_comment,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const createTravelReceipt = async ({ travelRequestId, uploadedBy, fileName, storedName, mimeType, fileSize, storagePath, amount, description }) => {
  const result = await query(
    `
      INSERT INTO travel_receipts (
        travel_request_id,
        uploaded_by,
        file_name,
        stored_name,
        mime_type,
        file_size,
        storage_path,
        amount,
        description,
        reimbursement_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'submitted')
      RETURNING id
    `,
    [travelRequestId, uploadedBy, fileName, storedName, mimeType, fileSize, storagePath, amount || null, description || null]
  );

  return findTravelReceiptById(result.rows[0].id);
};

const findTravelReceiptById = async (id) => {
  const result = await query(
    `
      SELECT
        tr.*,
        uploader.first_name AS uploader_first_name,
        uploader.last_name AS uploader_last_name,
        uploader.email AS uploader_email,
        reviewer.first_name AS reviewer_first_name,
        reviewer.last_name AS reviewer_last_name,
        reviewer.role AS reviewer_role
      FROM travel_receipts tr
      INNER JOIN users uploader ON uploader.id = tr.uploaded_by AND uploader.is_deleted = FALSE
      LEFT JOIN users reviewer ON reviewer.id = tr.reviewed_by
      WHERE tr.id = $1
      LIMIT 1
    `,
    [id]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    ...mapTravelReceipt(row),
    uploaderName: `${row.uploader_first_name} ${row.uploader_last_name}`,
    uploaderEmail: row.uploader_email,
    reviewerName: row.reviewer_first_name ? `${row.reviewer_first_name} ${row.reviewer_last_name}` : null,
    reviewerRole: row.reviewer_role
  };
};

const listTravelReceipts = async ({ travelRequestId, uploadedBy, reimbursementStatus } = {}) => {
  const clauses = [];
  const params = [];

  if (travelRequestId) {
    params.push(travelRequestId);
    clauses.push(`travel_request_id = $${params.length}`);
  }

  if (uploadedBy) {
    params.push(uploadedBy);
    clauses.push(`uploaded_by = $${params.length}`);
  }

  if (reimbursementStatus) {
    params.push(reimbursementStatus);
    clauses.push(`reimbursement_status = $${params.length}`);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query(
    `
      SELECT
        tr.id
      FROM travel_receipts tr
      ${whereClause}
      ORDER BY tr.created_at DESC
    `,
    params
  );

  const receipts = [];
  for (const row of result.rows) {
    receipts.push(await findTravelReceiptById(row.id));
  }
  return receipts;
};

const updateTravelReceiptStatus = async ({ id, reimbursementStatus, reviewedBy, reviewComment }) => {
  await query(
    `
      UPDATE travel_receipts
      SET
        reimbursement_status = COALESCE($2, reimbursement_status),
        reviewed_by = COALESCE($3, reviewed_by),
        reviewed_at = CASE WHEN $3 IS NOT NULL THEN NOW() ELSE reviewed_at END,
        review_comment = COALESCE($4, review_comment),
        updated_at = NOW()
      WHERE id = $1
    `,
    [id, reimbursementStatus, reviewedBy || null, reviewComment || null]
  );

  return findTravelReceiptById(id);
};

const deleteTravelReceipt = async (id) => {
  await query(`DELETE FROM travel_receipts WHERE id = $1`, [id]);
};

const listTravelReceiptsForCleanup = async (travelRequestId) => {
  const result = await query(
    `
      SELECT id, stored_name, mime_type, storage_path
      FROM travel_receipts
      WHERE travel_request_id = $1
      ORDER BY created_at DESC
    `,
    [travelRequestId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    storagePath: row.storage_path
  }));
};

const getTravelNotificationSettings = async () => {
  const result = await query(
    `SELECT * FROM travel_notification_settings ORDER BY id DESC LIMIT 1`
  );

  if (result.rows.length === 0) {
    return {
      id: null,
      notifyFinance: true,
      notifyAdmin: true,
      notifySupervisor: true,
      notifyCeo: false,
      customRecipients: []
    };
  }

  const row = result.rows[0];
  return {
    id: row.id,
    notifyFinance: row.notify_finance,
    notifyAdmin: row.notify_admin,
    notifySupervisor: row.notify_supervisor,
    notifyCeo: row.notify_ceo,
    customRecipients: row.custom_recipients || []
  };
};

const updateTravelNotificationSettings = async ({ notifyFinance, notifyAdmin, notifySupervisor, notifyCeo, customRecipients, updatedBy }) => {
  const existing = await query(`SELECT id FROM travel_notification_settings LIMIT 1`);

  if (existing.rows.length > 0) {
    await query(
      `
        UPDATE travel_notification_settings
        SET
          notify_finance = $2,
          notify_admin = $3,
          notify_supervisor = $4,
          notify_ceo = $5,
          custom_recipients = $6,
          updated_by = $7,
          updated_at = NOW()
        WHERE id = $1
      `,
      [existing.rows[0].id, notifyFinance, notifyAdmin, notifySupervisor, notifyCeo, customRecipients || [], updatedBy]
    );
  } else {
    await query(
      `
        INSERT INTO travel_notification_settings (
          notify_finance,
          notify_admin,
          notify_supervisor,
          notify_ceo,
          custom_recipients,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [notifyFinance, notifyAdmin, notifySupervisor, notifyCeo, customRecipients || [], updatedBy]
    );
  }

  return getTravelNotificationSettings();
};

const getTravelRecipientsForNotification = async (travelRequestId) => {
  const settings = await getTravelNotificationSettings();
  const travelRequest = await findTravelRequestById(travelRequestId);

  if (!travelRequest) {
    return [];
  }

  const recipients = [];
  const roles = [];

  if (settings.notifyFinance) {
    roles.push('finance');
  }
  if (settings.notifyAdmin) {
    roles.push('admin');
  }
  if (settings.notifyCeo) {
    roles.push('ceo');
  }

  if (roles.length > 0) {
    const result = await query(
      `
        SELECT email, first_name, last_name, role
        FROM users
        WHERE is_deleted = FALSE
          AND role = ANY($1)
      `,
      [roles]
    );

    recipients.push(...result.rows.map(row => ({
      email: row.email,
      name: `${row.first_name} ${row.last_name}`,
      role: row.role
    })));
  }

  if (settings.notifySupervisor && travelRequest.employeeSupervisorId) {
    const result = await query(
      `
        SELECT email, first_name, last_name, role
        FROM users
        WHERE id = $1 AND is_deleted = FALSE
      `,
      [travelRequest.employeeSupervisorId]
    );

    if (result.rows.length > 0) {
      recipients.push({
        email: result.rows[0].email,
        name: `${result.rows[0].first_name} ${result.rows[0].last_name}`,
        role: result.rows[0].role
      });
    }
  }

  if (settings.customRecipients && settings.customRecipients.length > 0) {
    settings.customRecipients.forEach(email => {
      if (email && !recipients.find(r => r.email === email)) {
        recipients.push({
          email: email.trim(),
          name: email.split('@')[0],
          role: 'custom'
        });
      }
    });
  }

  return recipients;
};

const getSummaryStats = async () => {
  const [pendingTravels, approvedTravels, pendingReceipts] = await Promise.all([
    query(
      `
        SELECT COUNT(*)::int AS total
        FROM travel_requests tr
        INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE
        WHERE tr.status = 'pending'
      `
    ),
    query(
      `
        SELECT COUNT(*)::int AS total
        FROM travel_requests tr
        INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE
        WHERE tr.status = 'approved'
      `
    ),
    query(
      `
        SELECT COUNT(*)::int AS total
        FROM travel_receipts tr
        INNER JOIN travel_requests treq ON treq.id = tr.travel_request_id
        WHERE tr.reimbursement_status IN ('submitted', 'under_review')
      `
    )
  ]);

  return {
    pendingTravels: pendingTravels.rows[0]?.total || 0,
    approvedTravels: approvedTravels.rows[0]?.total || 0,
    pendingReceipts: pendingReceipts.rows[0]?.total || 0
  };
};

const getSummaryStatsForUser = async (userId) => {
  const [pendingTravels, approvedTravels, pendingReceipts] = await Promise.all([
    query(
      `
        SELECT COUNT(*)::int AS total
        FROM travel_requests tr
        INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE
        WHERE tr.user_id = $1 AND tr.status = 'pending'
      `,
      [userId]
    ),
    query(
      `
        SELECT COUNT(*)::int AS total
        FROM travel_requests tr
        INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE
        WHERE tr.user_id = $1 AND tr.status = 'approved'
      `,
      [userId]
    ),
    query(
      `
        SELECT COUNT(*)::int AS total
        FROM travel_receipts tr
        INNER JOIN travel_requests treq ON treq.id = tr.travel_request_id
        WHERE treq.user_id = $1 AND tr.reimbursement_status IN ('submitted', 'under_review')
      `,
      [userId]
    )
  ]);

  return {
    pendingTravels: pendingTravels.rows[0]?.total || 0,
    approvedTravels: approvedTravels.rows[0]?.total || 0,
    pendingReceipts: pendingReceipts.rows[0]?.total || 0
  };
};

module.exports = {
  createTravelRequest,
  findTravelRequestById,
  listTravelRequests,
  updateTravelRequestStatus,
  updateTravelRequestDetails,
  cancelTravelRequest,
  deleteTravelRequest,
  createTravelReceipt,
  findTravelReceiptById,
  listTravelReceipts,
  updateTravelReceiptStatus,
  deleteTravelReceipt,
  listTravelReceiptsForCleanup,
  getTravelNotificationSettings,
  updateTravelNotificationSettings,
  getTravelRecipientsForNotification,
  getSummaryStats,
  getSummaryStatsForUser
};
