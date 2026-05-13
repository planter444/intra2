const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const { pool } = require('../config/db');
const documentModel = require('../models/documentModel');
const leaveModel = require('../models/leaveModel');
const userModel = require('../models/userModel');
const { deleteStoredDocument } = require('./documentService');

const buildDeletedEmail = (userId) => `deleted+${String(userId)}-${Date.now()}@deleted.local`;
const buildDeletedEmployeeNo = (userId) => `DEL-${String(userId)}-${Date.now().toString().slice(-8)}`;

const deleteEmployeeData = async (userId) => {
  const normalizedUserId = String(userId);
  const [documents, leaveRequests] = await Promise.all([
    documentModel.listForUser(normalizedUserId),
    leaveModel.listRequestsForUserCleanup(normalizedUserId)
  ]);

  for (const document of documents) {
    await deleteStoredDocument({
      storagePath: document.storagePath,
      storedName: document.storedName,
      mimeType: document.mimeType
    });
  }

  for (const request of leaveRequests) {
    if (!request.supportingDocumentPath) {
      continue;
    }

    await deleteStoredDocument({
      storagePath: request.supportingDocumentPath,
      storedName: request.supportingDocumentStoredName,
      mimeType: request.supportingDocumentMimeType
    });
  }

  await fs.promises.rm(path.join(env.filesRoot, normalizedUserId), { recursive: true, force: true });

  const documentIds = documents.map((document) => String(document.id));
  const leaveRequestIds = leaveRequests.map((request) => String(request.id));
  const cleanup = {
    documentsDeleted: 0,
    leaveRequestsDeleted: 0,
    leaveBalancesDeleted: 0,
    auditsDeleted: 0
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const baseAuditDeleteResult = await client.query(
      `
        DELETE FROM audit_logs
        WHERE actor_user_id = $1
           OR (entity_type = 'auth' AND entity_id = $2)
           OR (entity_type = 'user' AND entity_id = $2)
      `,
      [normalizedUserId, normalizedUserId]
    );
    cleanup.auditsDeleted += baseAuditDeleteResult.rowCount || 0;

    if (documentIds.length) {
      const documentAuditDeleteResult = await client.query(
        `DELETE FROM audit_logs WHERE entity_type = 'document' AND entity_id = ANY($1::text[])`,
        [documentIds]
      );
      cleanup.auditsDeleted += documentAuditDeleteResult.rowCount || 0;
    }

    if (leaveRequestIds.length) {
      const leaveAuditDeleteResult = await client.query(
        `DELETE FROM audit_logs WHERE entity_type = 'leave_request' AND entity_id = ANY($1::text[])`,
        [leaveRequestIds]
      );
      cleanup.auditsDeleted += leaveAuditDeleteResult.rowCount || 0;
    }

    const documentDeleteResult = await client.query(`DELETE FROM documents WHERE user_id = $1`, [normalizedUserId]);
    cleanup.documentsDeleted = documentDeleteResult.rowCount || 0;

    const leaveRequestDeleteResult = await client.query(`DELETE FROM leave_requests WHERE user_id = $1`, [normalizedUserId]);
    cleanup.leaveRequestsDeleted = leaveRequestDeleteResult.rowCount || 0;

    const leaveBalanceDeleteResult = await client.query(`DELETE FROM leave_balances WHERE user_id = $1`, [normalizedUserId]);
    cleanup.leaveBalancesDeleted = leaveBalanceDeleteResult.rowCount || 0;

    await client.query(
      `
        UPDATE users
        SET
          email = $2,
          employee_no = CASE WHEN employee_no IS NULL THEN NULL ELSE $3 END,
          is_deleted = TRUE,
          is_active = FALSE,
          deleted_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `,
      [normalizedUserId, buildDeletedEmail(normalizedUserId), buildDeletedEmployeeNo(normalizedUserId)]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const user = await userModel.findById(normalizedUserId);

  return {
    user,
    cleanup
  };
};

module.exports = {
  deleteEmployeeData
};
