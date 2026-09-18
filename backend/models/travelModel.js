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
  travelType: row.travel_type,
  startDate: formatDateOnly(row.start_date),
  endDate: formatDateOnly(row.end_date),
  origin: row.origin,
  destination: row.destination,
  reason: row.reason,
  estimatedCost: row.estimated_cost ? Number(row.estimated_cost) : null,
  currency: row.currency || 'KES',
  supportingDocumentId: row.supporting_document_id,
  status: row.status,
  approvedBy: row.approved_by,
  approvedAt: row.approved_at,
  rejectionReason: row.rejection_reason,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  designation: row.designation || null,
  travelCategory: row.travel_category || null,
  travelTypeDetail: row.travel_type_detail || null,
  projectProgramme: row.project_programme || null,
  dsaRate: row.dsa_rate ? Number(row.dsa_rate) : null,
  dsaCurrency: row.dsa_currency || 'KES',
  dsaAmount: row.dsa_amount ? Number(row.dsa_amount) : null,
  dsaProvided: row.dsa_provided || false,
  referenceNumber: row.reference_number || null,
  accommodationRate: row.accommodation_rate ? Number(row.accommodation_rate) : null,
  accommodationCurrency: row.accommodation_currency || 'KES',
  accommodationAmount: row.accommodation_amount ? Number(row.accommodation_amount) : null,
  accommodationProvided: row.accommodation_provided || false,
  transportationCost: row.transportation_cost ? Number(row.transportation_cost) : null,
  fullDayEvent: row.full_day_event || false,
  settled: row.settled || false
});

const generateReferenceNumber = async () => {
  const year = new Date().getFullYear();
  const result = await query(
    `
      SELECT COUNT(*) as count
      FROM travel_requests
      WHERE EXTRACT(YEAR FROM created_at) = $1
    `,
    [year]
  );
  
  const count = (result.rows[0]?.count || 0) + 1;
  const sequence = String(count).padStart(4, '0');
  return `KEREA-TRV-${year}-${sequence}`;
};

const createTravelRequest = async ({ userId, travelType, startDate, endDate, origin, destination, reason, estimatedCost, currency, supportingDocumentId, designation, travelCategory, travelTypeDetail, projectProgramme, dsaRate, dsaCurrency, dsaAmount, dsaProvided, accommodationRate, accommodationCurrency, accommodationAmount, accommodationProvided, transportationCost, fullDayEvent }) => {
  const referenceNumber = await generateReferenceNumber();

  let result;
  try {
    result = await query(
      `
        INSERT INTO travel_requests (
          user_id,
          travel_type,
          start_date,
          end_date,
          origin,
          destination,
          reason,
          estimated_cost,
          currency,
          supporting_document_id,
          designation,
          travel_category,
          travel_type_detail,
          project_programme,
          dsa_rate,
          dsa_currency,
          dsa_amount,
          dsa_provided,
          accommodation_rate,
          accommodation_currency,
          accommodation_amount,
          accommodation_provided,
          transportation_cost,
          full_day_event,
          reference_number,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, 'pending')
        RETURNING id
      `,
      [userId, travelType || 'booking', startDate, endDate, origin, destination, reason, estimatedCost || null, currency || 'KES', supportingDocumentId || null, designation || null, travelCategory || null, travelTypeDetail || null, projectProgramme || null, dsaRate || null, dsaCurrency || 'KES', dsaAmount || null, dsaProvided || false, accommodationRate || null, accommodationCurrency || 'KES', accommodationAmount || null, accommodationProvided || false, transportationCost || null, fullDayEvent || false, referenceNumber]
    );
  } catch (error) {
    console.error('Travel request insert error:', error.message);
    // Don't use fallback - throw the actual error so it can be fixed properly
    throw error;
  }

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
  const oversightRoles = ['admin', 'ceo', 'finance', 'it_officer', 'administrator', 'membership_officer'];

  // Check if viewer has access to view all travel requests
  const notificationSettings = await getTravelNotificationSettings();
  const canViewAll = notificationSettings && notificationSettings.viewAllTravelRequestsIds && notificationSettings.viewAllTravelRequestsIds.includes(viewerId);

  // Admin, membership officer, and administrator always have view-all access
  const hasAutomaticViewAll = role === 'admin' || role === 'membership_officer' || role === 'administrator';

  console.log('listTravelRequests - viewerId:', viewerId, 'role:', role, 'canViewAll:', canViewAll, 'hasAutomaticViewAll:', hasAutomaticViewAll);

  if (role === 'employee') {
    // Employees see their own requests, unless they have view-all access
    if (!canViewAll && !hasAutomaticViewAll) {
      params.push(viewerId);
      clauses.push(`tr.user_id = $${params.length}`);
    }
  } else if (role === 'supervisor') {
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
  } else if (!oversightRoles.includes(role) && !canViewAll && !hasAutomaticViewAll) {
    // For any other role not in oversight and without view-all access, only show own requests
    params.push(viewerId);
    clauses.push(`tr.user_id = $${params.length}`);
  }
  // For oversight roles (admin, ceo, finance, it_officer), membership officer, administrator, and users with view-all access, no user filter - they see all

  if (userId && (oversightRoles.includes(role) || canViewAll || hasAutomaticViewAll)) {
    params.push(userId);
    clauses.push(`tr.user_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    clauses.push(`tr.status = $${params.length}`);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  console.log('listTravelRequests - SQL whereClause:', whereClause);
  console.log('listTravelRequests - SQL params:', params);

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

  console.log('listTravelRequests - Found', result.rows.length, 'travel requests');

  const requests = [];
  for (const row of result.rows) {
    requests.push(await findTravelRequestById(row.id));
  }
  console.log('listTravelRequests - Returning', requests.length, 'requests');
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

const updateTravelRequestDetails = async ({ id, startDate, endDate, origin, destination, reason, estimatedCost, designation, travelCategory, travelTypeDetail, projectProgramme, dsaRate, dsaCurrency, dsaAmount, dsaProvided, accommodationRate, accommodationCurrency, accommodationAmount, accommodationProvided, transportationCost, fullDayEvent, supportingDocumentId }) => {
  let result;
  console.log('MODEL UPDATE - Received params:', {
    id,
    dsaAmount,
    accommodationAmount,
    dsaProvided,
    accommodationProvided,
    transportationCost,
    fullDayEvent,
    projectProgramme,
    travelCategory
  });

  try {
    result = await query(
      `
        UPDATE travel_requests
        SET
          start_date = $2,
          end_date = $3,
          origin = $4,
          destination = $5,
          reason = $6,
          estimated_cost = $7,
          designation = $8,
          travel_category = $9,
          travel_type_detail = $10,
          project_programme = $11,
          dsa_rate = $12,
          dsa_currency = $13,
          dsa_amount = $14,
          dsa_provided = $15,
          accommodation_rate = $16,
          accommodation_currency = $17,
          accommodation_amount = $18,
          accommodation_provided = $19,
          transportation_cost = $20,
          full_day_event = $21,
          supporting_document_id = $22,
          updated_at = NOW()
        WHERE id = $1
      `,
      [id, startDate, endDate, origin, destination, reason, estimatedCost, designation, travelCategory, travelTypeDetail, projectProgramme, dsaRate, dsaCurrency, dsaAmount, dsaProvided, accommodationRate, accommodationCurrency, accommodationAmount, accommodationProvided, transportationCost, fullDayEvent, supportingDocumentId]
    );
    console.log('MODEL UPDATE - Query executed successfully, rows affected:', result.rowCount);
  } catch (error) {
    console.error('Travel request update error:', error.message);
    // Don't use fallback - throw the actual error so it can be fixed properly
    throw error;
  }

  const updated = await findTravelRequestById(id);
  console.log('MODEL UPDATE - Updated request:', {
    dsaAmount: updated.dsaAmount,
    dsaProvided: updated.dsa_provided,
    accommodationAmount: updated.accommodationAmount,
    accommodationProvided: updated.accommodation_provided,
    transportationCost: updated.transportation_cost,
    projectProgramme: updated.projectProgramme,
    travelCategory: updated.travelCategory
  });

  return updated;
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
  let result;
  try {
    result = await query(
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
  } catch (dbError) {
    console.error('Failed to insert travel receipt:', dbError.message);
    // Don't use fallback - throw the actual error so it can be fixed properly
    throw dbError;
  }

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
    console.log('getTravelNotificationSettings - No settings found, returning defaults');
    return {
      id: null,
      recipientIds: [],
      viewAllTravelRequestsIds: []
    };
  }

  const row = result.rows[0];
  const settings = {
    id: row.id,
    recipientIds: row.recipient_ids || [],
    viewAllTravelRequestsIds: row.view_all_travel_requests_ids || []
  };
  console.log('getTravelNotificationSettings - Settings loaded:', settings);
  return settings;
};

const updateTravelNotificationSettings = async ({ recipientIds, viewAllTravelRequestsIds, updatedBy }) => {
  const existing = await query(`SELECT id FROM travel_notification_settings LIMIT 1`);

  if (existing.rows.length > 0) {
    await query(
      `
        UPDATE travel_notification_settings
        SET
          recipient_ids = $2,
          view_all_travel_requests_ids = $3,
          updated_by = $4,
          updated_at = NOW()
        WHERE id = $1
      `,
      [existing.rows[0].id, recipientIds || [], viewAllTravelRequestsIds || [], updatedBy]
    );
  } else {
    await query(
      `
        INSERT INTO travel_notification_settings (
          recipient_ids,
          view_all_travel_requests_ids,
          updated_by
        )
        VALUES ($1, $2, $3)
      `,
      [recipientIds || [], viewAllTravelRequestsIds || [], updatedBy]
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

const getTravelRoutingSettings = async () => {
  const result = await query(
    `
      SELECT
        id,
        route_to_supervisor,
        route_to_ceo,
        route_to_admin,
        updated_by,
        created_at,
        updated_at
      FROM travel_routing_settings
      ORDER BY id DESC
      LIMIT 1
    `
  );

  if (result.rows.length === 0) {
    return {
      routeToSupervisor: true,
      routeToCeo: false,
      routeToAdmin: false
    };
  }

  const row = result.rows[0];
  return {
    id: row.id,
    routeToSupervisor: row.route_to_supervisor,
    routeToCeo: row.route_to_ceo,
    routeToAdmin: row.route_to_admin,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const updateTravelRoutingSettings = async ({ routeToSupervisor, routeToCeo, routeToAdmin, updatedBy }) => {
  const existing = await query(
    `
      SELECT id
      FROM travel_routing_settings
      ORDER BY id DESC
      LIMIT 1
    `
  );

  let result;
  if (existing.rows.length > 0) {
    result = await query(
      `
        UPDATE travel_routing_settings
        SET
          route_to_supervisor = $1,
          route_to_ceo = $2,
          route_to_admin = $3,
          updated_by = $4,
          updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `,
      [routeToSupervisor, routeToCeo, routeToAdmin, updatedBy, existing.rows[0].id]
    );
  } else {
    result = await query(
      `
        INSERT INTO travel_routing_settings (
          route_to_supervisor,
          route_to_ceo,
          route_to_admin,
          updated_by
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [routeToSupervisor, routeToCeo, routeToAdmin, updatedBy]
    );
  }

  const row = result.rows[0];
  return {
    id: row.id,
    routeToSupervisor: row.route_to_supervisor,
    routeToCeo: row.route_to_ceo,
    routeToAdmin: row.route_to_admin,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const getEmployeeTravelRouting = async (employeeId) => {
  const result = await query(
    `
      SELECT
        ter.id,
        ter.employee_id,
        ter.approver_id,
        u.full_name as approver_name,
        u.email as approver_email,
        u.role as approver_role,
        ter.created_at,
        ter.updated_at
      FROM travel_employee_routing ter
      INNER JOIN users u ON u.id = ter.approver_id
      WHERE ter.employee_id = $1
      ORDER BY ter.created_at DESC
    `,
    [employeeId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    approverId: row.approver_id,
    approverName: row.approver_name,
    approverEmail: row.approver_email,
    approverRole: row.approver_role,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
};

const getAllEmployeeRouting = async () => {
  const result = await query(
    `
      SELECT
        ter.id,
        ter.employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email,
        ter.approver_id,
        a.first_name || ' ' || a.last_name as approver_name,
        a.email as approver_email,
        a.role as approver_role,
        ter.created_at,
        ter.updated_at
      FROM travel_employee_routing ter
      INNER JOIN users e ON e.id = ter.employee_id
      INNER JOIN users a ON a.id = ter.approver_id
      ORDER BY ter.employee_id, ter.created_at DESC
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeEmail: row.employee_email,
    approverId: row.approver_id,
    approverName: row.approver_name,
    approverEmail: row.approver_email,
    approverRole: row.approver_role,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
};

const getApproverForEmployee = async (employeeId) => {
  const result = await query(
    `
      SELECT approver_id
      FROM travel_employee_routing
      WHERE employee_id = $1
      ORDER BY created_at DESC
    `,
    [employeeId]
  );

  if (result.rows.length === 0) {
    // Default to CEO if no specific routing exists
    const ceoResult = await query(
      `
        SELECT id
        FROM users
        WHERE role = 'ceo'
        LIMIT 1
      `
    );
    if (ceoResult.rows.length > 0) {
      return [ceoResult.rows[0].id];
    }
    return [];
  }

  // Return all approvers for this employee
  return result.rows.map(row => row.approver_id);
};

const addEmployeeRouting = async ({ employeeId, approverId }) => {
  try {
    const result = await query(
      `
        INSERT INTO travel_employee_routing (employee_id, approver_id)
        VALUES ($1, $2)
        RETURNING *
      `,
      [employeeId, approverId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      employeeId: row.employee_id,
      approverId: row.approver_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (error) {
    // If duplicate, just return null (routing already exists)
    if (error.message.includes('duplicate key')) {
      return null;
    }
    throw error;
  }
};

const removeEmployeeRouting = async (id) => {
  await query(
    `
      DELETE FROM travel_employee_routing WHERE id = $1
    `,
    [id]
  );
  return true;
};

const updateTravelRequestSettled = async (id, settled) => {
  await query(
    `
      UPDATE travel_requests
      SET settled = $1
      WHERE id = $2
    `,
    [settled, id]
  );
  return true;
};

const getPendingTravelRequestCountForUser = async (userId, userRole) => {
  let result;

  // Check if user is a notification recipient
  const notificationSettings = await getTravelNotificationSettings();
  const isNotificationRecipient = notificationSettings && notificationSettings.recipientIds && notificationSettings.recipientIds.includes(userId);

  if (userRole === 'admin' || userRole === 'ceo' || userRole === 'finance' || isNotificationRecipient) {
    // Admin, CEO, finance, and notification recipients can see all pending requests
    result = await query(
      `
        SELECT COUNT(*) as count
        FROM travel_requests
        WHERE status = 'pending'
      `
    );
  } else if (userRole === 'supervisor') {
    // Supervisors can see pending requests from their team members
    try {
      result = await query(
        `
          SELECT COUNT(*) as count
          FROM travel_requests tr
          INNER JOIN users u ON u.id = tr.user_id
          WHERE tr.status = 'pending' AND u.employee_supervisor_id = $1
        `,
        [userId]
      );
    } catch (error) {
      console.warn('employee_supervisor_id column does not exist, using fallback query');
      // Fallback: return 0 if column doesn't exist
      result = { rows: [{ count: 0 }] };
    }
  } else {
    // Regular employees can only see requests where they are one of the designated approvers
    result = await query(
      `
        SELECT COUNT(*) as count
        FROM travel_requests tr
        INNER JOIN travel_employee_routing ter ON ter.employee_id = tr.user_id
        WHERE tr.status = 'pending' AND ter.approver_id = $1
      `,
      [userId]
    );
  }

  return parseInt(result.rows[0].count, 10);
};

const markTravelRequestAsViewed = async (travelRequestId, userId) => {
  await query(
    `
      INSERT INTO travel_request_views (travel_request_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (travel_request_id, user_id) DO UPDATE SET viewed_at = NOW()
    `,
    [travelRequestId, userId]
  );
  return true;
};

const getPendingTravelRequestCountForUserExcludingViewed = async (userId, userRole) => {
  let result;

  // Check if user has access to view all travel requests
  const notificationSettings = await getTravelNotificationSettings();
  const canViewAll = notificationSettings && notificationSettings.viewAllTravelRequestsIds && notificationSettings.viewAllTravelRequestsIds.includes(userId);

  const oversightRoles = ['admin', 'ceo', 'finance', 'it_officer', 'administrator', 'membership_officer'];

  if (oversightRoles.includes(userRole) || canViewAll) {
    // Admin, CEO, finance, membership officer, administrator, and users with view-all access can see all pending requests
    // Exclude those they've already viewed
    result = await query(
      `
        SELECT COUNT(*) as count
        FROM travel_requests tr
        WHERE tr.status = 'pending'
        AND tr.id NOT IN (
          SELECT travel_request_id FROM travel_request_views WHERE user_id = $1
        )
      `,
      [userId]
    );
  } else if (userRole === 'supervisor') {
    // Supervisors can see pending requests from their team members
    try {
      result = await query(
        `
          SELECT COUNT(*) as count
          FROM travel_requests tr
          INNER JOIN users u ON u.id = tr.user_id
          WHERE tr.status = 'pending' AND u.employee_supervisor_id = $1
          AND tr.id NOT IN (
            SELECT travel_request_id FROM travel_request_views WHERE user_id = $1
          )
        `,
        [userId]
      );
    } catch (error) {
      console.warn('employee_supervisor_id column does not exist, using fallback query');
      // Fallback: return 0 if column doesn't exist
      result = { rows: [{ count: 0 }] };
    }
  } else {
    // Regular employees can only see requests where they are one of the designated approvers
    result = await query(
      `
        SELECT COUNT(*) as count
        FROM travel_requests tr
        INNER JOIN travel_employee_routing ter ON ter.employee_id = tr.user_id
        WHERE tr.status = 'pending' AND ter.approver_id = $1
        AND tr.id NOT IN (
          SELECT travel_request_id FROM travel_request_views WHERE user_id = $1
        )
      `,
      [userId]
    );
  }

  return parseInt(result.rows[0].count, 10);
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
  getTravelRoutingSettings,
  updateTravelRoutingSettings,
  getAllEmployeeRouting,
  getApproverForEmployee,
  addEmployeeRouting,
  removeEmployeeRouting,
  getPendingTravelRequestCountForUser,
  getPendingTravelRequestCountForUserExcludingViewed,
  markTravelRequestAsViewed,
  updateTravelRequestSettled,
  getSummaryStats,
  getSummaryStatsForUser
};
