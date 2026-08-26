const fs = require('fs');
const auditModel = require('../models/auditModel');
const travelModel = require('../models/travelModel');
const { query } = require('../config/db');
const { logAction } = require('../services/auditService');
const { sendTravelRequestSubmittedEmail, sendTravelReceiptNotificationEmail, sendTravelDecisionEmail, buildTravelRequestUrl } = require('../services/mailService');
const { deleteStoredDocument, getRemoteDocumentUrl, isRemoteStoragePath, resolveDocumentPath, saveDocument } = require('../services/documentService');

const oversightRoles = ['admin', 'ceo', 'finance', 'it_officer'];

const canViewOversightTravelData = (role) => oversightRoles.includes(role);

const canAccessTravelRequest = (currentUser, request) => {
  if (canViewOversightTravelData(currentUser.role)) {
    return true;
  }

  if (String(request.userId) === String(currentUser.id)) {
    return true;
  }

  return currentUser.role === 'supervisor' && String(request.employeeSupervisorId) === String(currentUser.id);
};

const canRequesterModify = (currentUser, request) => {
  if (String(request.userId) !== String(currentUser.id)) {
    return false;
  }

  return ['pending', 'rejected'].includes(request.status);
};

const canUpdateReceiptStatus = (currentUser, receipt) => {
  if (currentUser.role === 'admin' || currentUser.role === 'ceo' || currentUser.role === 'finance') {
    return true;
  }

  if (currentUser.role === 'supervisor') {
    const travelRequest = travelModel.findTravelRequestById(receipt.travelRequestId);
    return travelRequest && String(travelRequest.employeeSupervisorId) === String(currentUser.id);
  }

  return false;
};

const sendRemoteDocument = async ({ res, url, mimeType, fileName, disposition = 'attachment' }) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Unable to fetch remote travel receipt.');
  }

  const arrayBuffer = await response.arrayBuffer();
  res.setHeader('Content-Type', mimeType || response.headers.get('content-type') || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${disposition}; filename="${fileName || 'travel-receipt'}"`);
  res.send(Buffer.from(arrayBuffer));
};

const listTravelRequests = async (req, res, next) => {
  try {
    const requests = await travelModel.listTravelRequests({
      viewerId: req.user.id,
      role: req.user.role,
      status: req.query.status
    });

    res.json({ requests });
  } catch (error) {
    next(error);
  }
};

const getTravelRequest = async (req, res, next) => {
  try {
    const request = await travelModel.findTravelRequestById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Travel request not found.' });
    }

    if (!canAccessTravelRequest(req.user, request)) {
      return res.status(403).json({ message: 'You do not have permission to view this travel request.' });
    }

    const receipts =	await travelModel.listTravelReceipts({ travelRequestId: request.id });
    res.json({ request: { ...request, receipts } });
  } catch (error) {
    next(error);
  }
};

const createTravelRequest = async (req, res, next) => {
  try {
    const { travelType, startDate, endDate, origin, destination, reason, estimatedCost, currency, designation, travelCategory, travelTypeDetail, projectProgramme, dsaRate, dsaCurrency, dsaAmount, dsaProvided } = req.body;

    if (!startDate || !endDate || !origin || !destination || !reason) {
      return res.status(400).json({ message: 'Start date, end date, origin, destination, and reason are required.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({ message: 'Start date must be before or equal to end date.' });
    }

    let supportingDocumentId = null;
    let supportingDocumentPath = null;
    
    // Handle supporting document upload for booking type
    if (travelType === 'booking' && req.file) {
      try {
        const { storedName, targetPath } = await saveDocument({
          userId: String(req.user.id),
          folderType: 'travel',
          file: req.file
        });
        
        supportingDocumentPath = targetPath;
        
        // Try to create document record for tracking, but don't fail if it doesn't work
        try {
          const documentResult = await query(
            `
              INSERT INTO documents (user_id, uploaded_by, folder_type, file_name, stored_name, mime_type, file_size, storage_path)
              VALUES ($1, $2, 'travel', $3, $4, $5, $6, $7)
              RETURNING id
            `,
            [req.user.id, req.user.id, req.file.originalname, storedName, req.file.mimetype, req.file.size, targetPath]
          );
          supportingDocumentId = documentResult.rows[0].id;
        } catch (docError) {
          console.warn('Failed to create document record (will use direct path):', docError.message);
          // Continue without document record - we'll use the direct path
        }
      } catch (uploadError) {
        console.error('Failed to upload supporting document:', uploadError.message);
        // Continue without the document - it's optional
      }
    }

    // Create travel request with new fields
    let request;
    try {
      request = await travelModel.createTravelRequest({
        userId: req.user.id,
        travelType: travelType || 'booking',
        startDate,
        endDate,
        origin,
        destination,
        reason,
        estimatedCost: estimatedCost || null,
        currency: currency || 'KES',
        supportingDocumentId,
        designation: designation || req.user.designation || null,
        travelCategory: travelCategory || null,
        travelTypeDetail: travelTypeDetail || null,
        projectProgramme: projectProgramme || null,
        dsaRate: dsaRate || null,
        dsaCurrency: dsaCurrency || 'KES',
        dsaAmount: dsaAmount || null,
        dsaProvided: dsaProvided || false
      });
    } catch (dbError) {
      // If the error is about new columns not existing, retry without them
      if (dbError.message && (dbError.message.includes('designation') || dbError.message.includes('travel_category'))) {
        console.warn('New travel columns not found, creating request without them');
        request = await travelModel.createTravelRequest({
          userId: req.user.id,
          travelType: travelType || 'booking',
          startDate,
          endDate,
          origin,
          destination,
          reason,
          estimatedCost: estimatedCost || null,
          currency: currency || 'KES',
          supportingDocumentId: null
        });
      } else {
        throw dbError;
      }
    }

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TRAVEL_CREATE',
      entityType: 'travel_request',
      entityId: String(request.id),
      description: `${req.user.fullName} submitted a travel request.`,
      metadata: { travelType, origin, destination, startDate, endDate, referenceNumber: request.referenceNumber },
      ipAddress: req.ip
    });

    // Send email notification to approver (best-effort)
    try {
      const approverId = await travelModel.getApproverForEmployee(req.user.id);
      if (approverId) {
        const approverResult = await query(
          `SELECT id, first_name, last_name, email FROM users WHERE id = $1`,
          [approverId]
        );
        if (approverResult.rows.length > 0) {
          const approver = approverResult.rows[0];
          await sendTravelRequestSubmittedEmail({
            recipients: [{ id: approver.id, fullName: `${approver.first_name} ${approver.last_name}`, email: approver.email }],
            travelRequest: request,
            applicantName: req.user.fullName
          });
        }
      }
    } catch (emailError) {
      // Best-effort email - don't fail the request if email fails
      console.error('Failed to send travel request notification email:', emailError.message);
    }

    res.status(201).json({ request });
  } catch (error) {
    next(error);
  }
};

const updateTravelRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, origin, destination, reason, estimatedCost } = req.body;
    const request = await travelModel.findTravelRequestById(id);

    if (!request) {
      return res.status(404).json({ message: 'Travel request not found.' });
    }

    if (!canRequesterModify(req.user, request)) {
      return res.status(403).json({ message: 'This travel request can no longer be edited.' });
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start > end) {
        return res.status(400).json({ message: 'Start date must be before or equal to end date.' });
      }
    }

    const updatedRequest = await travelModel.updateTravelRequestDetails({
      id,
      startDate: startDate || request.startDate,
      endDate: endDate || request.endDate,
      origin: origin || request.origin,
      destination: destination || request.destination,
      reason: reason ?? request.reason,
      estimatedCost: estimatedCost !== undefined ? estimatedCost : request.estimatedCost
    });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TRAVEL_UPDATE',
      entityType: 'travel_request',
      entityId: String(id),
      description: `${req.user.fullName} updated travel request ${id}.`,
      metadata: {},
      ipAddress: req.ip
    });

    res.json({ request: updatedRequest });
  } catch (error) {
    next(error);
  }
};

const cancelTravelRequest = async (req, res, next) => {
  try {
    const request = await travelModel.findTravelRequestById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Travel request not found.' });
    }

    if (!canRequesterModify(req.user, request)) {
      return res.status(403).json({ message: 'This travel request can no longer be cancelled.' });
    }

    await travelModel.cancelTravelRequest(req.params.id);

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TRAVEL_CANCEL',
      entityType: 'travel_request',
      entityId: String(req.params.id),
      description: `${req.user.fullName} cancelled travel request ${req.params.id}.`,
      metadata: {},
      ipAddress: req.ip
    });

    res.json({ request: null });
  } catch (error) {
    next(error);
  }
};

const decideTravelRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { decision, comment } = req.body;
    const request = await travelModel.findTravelRequestById(id);

    if (!request) {
      return res.status(404).json({ message: 'Travel request not found.' });
    }

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ message: 'Decision must be approve or reject.' });
    }

    if (!['pending', 'rejected'].includes(request.status)) {
      return res.status(400).json({ message: 'Only pending or rejected travel requests can be actioned.' });
    }

    // ONLY check employee-specific routing - this is the only approval strategy
    const approverForEmployee = await travelModel.getApproverForEmployee(request.userId);
    
    // CEO can approve their own requests
    if (req.user.role === 'ceo' && String(request.userId) === String(req.user.id)) {
      // CEO can self-approve
    } 
    // IT officers can approve for themselves if they are the designated approver
    else if (req.user.role === 'it_officer' && String(request.userId) === String(req.user.id) && String(approverForEmployee) === String(req.user.id)) {
      // IT officer can self-approve if they are the designated approver
    }
    // User must be the designated approver for this employee
    else if (!approverForEmployee || String(approverForEmployee) !== String(req.user.id)) {
      return res.status(403).json({ message: 'You are not authorized to approve this travel request. Only the designated approver in employee-specific routing can approve.' });
    }

    const normalizedComment = typeof comment === 'string' ? comment.trim() : '';
    const nextStatus = decision === 'approve' ? 'approved' : 'rejected';

    const updatedRequest = await travelModel.updateTravelRequestStatus({
      id,
      status: nextStatus,
      approvedBy: req.user.id,
      rejectionReason: decision === 'reject' ? normalizedComment || null : null
    });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: decision === 'approve' ? 'TRAVEL_APPROVE' : 'TRAVEL_REJECT',
      entityType: 'travel_request',
      entityId: String(id),
      description: `${req.user.fullName} ${decision}d travel request ${id}.`,
      metadata: { comment: normalizedComment },
      ipAddress: req.ip
    });

    // Send email notification to applicant (best-effort)
    try {
      const applicantResult = await query(
        `SELECT id, first_name, last_name, email FROM users WHERE id = $1`,
        [request.userId]
      );
      if (applicantResult.rows.length > 0) {
        const applicant = applicantResult.rows[0];
        await sendTravelDecisionEmail({
          toEmail: applicant.email,
          toName: `${applicant.first_name} ${applicant.last_name}`,
          travelRequest: updatedRequest,
          decision,
          reviewerName: req.user.fullName,
          comment: normalizedComment
        });
      }
    } catch (emailError) {
      // Best-effort email - don't fail the request if email fails
      console.error('Failed to send travel decision notification email:', emailError.message);
    }

    res.json({ request: updatedRequest });
  } catch (error) {
    next(error);
  }
};

const deleteTravelRequestPermanently = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await travelModel.findTravelRequestById(id);
    if (!request) {
      return res.status(404).json({ message: 'Travel request not found.' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the IT Officer can delete travel requests.' });
    }

    const receipts = await travelModel.listTravelReceiptsForCleanup(id);
    for (const receipt of receipts) {
      await deleteStoredDocument({
        storagePath: receipt.storagePath,
        storedName: receipt.storedName,
        mimeType: receipt.mimeType
      });
    }

    await travelModel.deleteTravelRequest(id);

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TRAVEL_DELETE',
      entityType: 'travel_request',
      entityId: String(id),
      description: `${req.user.fullName} permanently deleted travel request ${id}.`,
      metadata: {},
      ipAddress: req.ip
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const listTravelReceipts = async (req, res, next) => {
  try {
    const receipts = await travelModel.listTravelReceipts({
      travelRequestId: req.query.travelRequestId,
      uploadedBy: req.query.uploadedBy,
      reimbursementStatus: req.query.reimbursementStatus
    });

    res.json({ receipts });
  } catch (error) {
    next(error);
  }
};

const getTravelReceipt = async (req, res, next) => {
  try {
    const receipt = await travelModel.findTravelReceiptById(req.params.id);
    if (!receipt) {
      return res.status(404).json({ message: 'Travel receipt not found.' });
    }

    const travelRequest = await travelModel.findTravelRequestById(receipt.travelRequestId);
    if (!canAccessTravelRequest(req.user, travelRequest)) {
      return res.status(403).json({ message: 'You do not have permission to view this travel receipt.' });
    }

    res.json({ receipt });
  } catch (error) {
    next(error);
  }
};

const uploadTravelReceipt = async (req, res, next) => {
  try {
    const { travelRequestId, amount, description } = req.body;

    if (!travelRequestId) {
      return res.status(400).json({ message: 'Travel request ID is required.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Receipt file is required.' });
    }

    const travelRequest = await travelModel.findTravelRequestById(travelRequestId);
    if (!travelRequest) {
      return res.status(404).json({ message: 'Travel request not found.' });
    }

    if (String(travelRequest.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'You can only upload receipts for your own travel requests.' });
    }

    // Allow receipt upload for reimbursement requests regardless of status
    // For booking requests, require approval first
    if (travelRequest.travelType === 'booking' && travelRequest.status !== 'approved') {
      return res.status(400).json({ message: 'Receipts can only be uploaded for approved travel bookings.' });
    }

    const { storedName, targetPath } = await saveDocument({
      userId: String(req.user.id),
      folderType: 'travel_receipts',
      file: req.file
    });

    let receipt;
    try {
      receipt = await travelModel.createTravelReceipt({
        travelRequestId,
        uploadedBy: req.user.id,
        fileName: req.file.originalname,
        storedName,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        storagePath: targetPath,
        amount: amount || null,
        description: description || null
      });
    } catch (dbError) {
      console.error('Failed to create travel receipt record:', dbError.message);
      // Try to clean up the uploaded file if database insert failed
      try {
        await deleteStoredDocument({
          storagePath: targetPath,
          storedName,
          mimeType: req.file.mimetype
        });
      } catch (cleanupError) {
        console.error('Failed to clean up uploaded file:', cleanupError.message);
      }
      throw dbError;
    }

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TRAVEL_RECEIPT_UPLOAD',
      entityType: 'travel_receipt',
      entityId: String(receipt.id),
      description: `${req.user.fullName} uploaded a travel receipt for travel request ${travelRequestId}.`,
      metadata: { amount, description },
      ipAddress: req.ip
    });

    // Send notification to configured recipients
    const recipients = await travelModel.getTravelRecipientsForNotification(travelRequestId);
    sendTravelReceiptNotificationEmail({
      recipients,
      travelRequest,
      receipt,
      uploaderName: req.user.fullName
    }).catch((error) => console.error('Unable to send travel receipt notification email.', error.message));

    res.status(201).json({ receipt });
  } catch (error) {
    console.error('Travel receipt upload error:', error);
    next(error);
  }
};

const updateTravelReceiptStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reimbursementStatus, reviewComment } = req.body;
    const receipt = await travelModel.findTravelReceiptById(id);

    if (!receipt) {
      return res.status(404).json({ message: 'Travel receipt not found.' });
    }

    if (!canUpdateReceiptStatus(req.user, receipt)) {
      return res.status(403).json({ message: 'You do not have permission to update this receipt status.' });
    }

    const validStatuses = ['pending', 'submitted', 'under_review', 'approved', 'rejected', 'settled', 'not_settled'];
    if (!validStatuses.includes(reimbursementStatus)) {
      return res.status(400).json({ message: 'Invalid reimbursement status.' });
    }

    const updatedReceipt = await travelModel.updateTravelReceiptStatus({
      id,
      reimbursementStatus,
      reviewedBy: req.user.id,
      reviewComment: reviewComment || null
    });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TRAVEL_RECEIPT_STATUS_UPDATE',
      entityType: 'travel_receipt',
      entityId: String(id),
      description: `${req.user.fullName} updated travel receipt ${id} status to ${reimbursementStatus}.`,
      metadata: { reimbursementStatus, reviewComment },
      ipAddress: req.ip
    });

    res.json({ receipt: updatedReceipt });
  } catch (error) {
    next(error);
  }
};

const deleteTravelReceipt = async (req, res, next) => {
  try {
    const receipt = await travelModel.findTravelReceiptById(req.params.id);
    if (!receipt) {
      return res.status(404).json({ message: 'Travel receipt not found.' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the IT Officer can delete travel receipts.' });
    }

    await deleteStoredDocument({
      storagePath: receipt.storagePath,
      storedName: receipt.storedName,
      mimeType: receipt.mimeType
    });

    await travelModel.deleteTravelReceipt(req.params.id);

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TRAVEL_RECEIPT_DELETE',
      entityType: 'travel_receipt',
      entityId: String(req.params.id),
      description: `${req.user.fullName} deleted travel receipt ${req.params.id}.`,
      metadata: {},
      ipAddress: req.ip
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const downloadTravelReceipt = async (req, res, next) => {
  try {
    const receipt = await travelModel.findTravelReceiptById(req.params.id);
    if (!receipt) {
      return res.status(404).json({ message: 'Travel receipt not found.' });
    }

    const travelRequest = await travelModel.findTravelRequestById(receipt.travelRequestId);
    if (!canAccessTravelRequest(req.user, travelRequest)) {
      return res.status(403).json({ message: 'You do not have permission to access this receipt.' });
    }

    const disposition = req.query.preview === 'true' ? 'inline' : 'attachment';

    if (isRemoteStoragePath(receipt.storagePath)) {
      await sendRemoteDocument({
        res,
        url: getRemoteDocumentUrl({
          storedName: receipt.storedName,
          mimeType: receipt.mimeType,
          fileName: receipt.fileName,
          asAttachment: req.query.preview !== 'true'
        }),
        mimeType: receipt.mimeType,
        fileName: receipt.fileName,
        disposition
      });
      return;
    }

    const filePath = resolveDocumentPath(receipt.storagePath);
    res.setHeader('Content-Type', receipt.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${disposition}; filename="${receipt.fileName || 'travel-receipt'}"`);

    const stream = fs.createReadStream(filePath);
    stream.on('error', next);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

const getTravelNotificationSettings = async (req, res, next) => {
  try {
    const settings = await travelModel.getTravelNotificationSettings();
    res.json({ settings });
  } catch (error) {
    next(error);
  }
};

const updateTravelNotificationSettings = async (req, res, next) => {
  try {
    const { recipientIds } = req.body;

    const settings = await travelModel.updateTravelNotificationSettings({
      recipientIds: recipientIds || [],
      updatedBy: req.user.id
    });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TRAVEL_NOTIFICATION_SETTINGS_UPDATE',
      entityType: 'travel_notification_settings',
      entityId: String(settings.id || '1'),
      description: `${req.user.fullName} updated travel notification settings.`,
      metadata: { recipientIds },
      ipAddress: req.ip
    });

    res.json({ settings });
  } catch (error) {
    next(error);
  }
};

const getTravelRoutingSettings = async (req, res, next) => {
  try {
    const settings = await travelModel.getTravelRoutingSettings();
    res.json({ settings });
  } catch (error) {
    next(error);
  }
};

const updateTravelRoutingSettings = async (req, res, next) => {
  try {
    const { routeToSupervisor, routeToCeo, routeToAdmin } = req.body;

    const settings = await travelModel.updateTravelRoutingSettings({
      routeToSupervisor: routeToSupervisor !== undefined ? routeToSupervisor : true,
      routeToCeo: routeToCeo !== undefined ? routeToCeo : false,
      routeToAdmin: routeToAdmin !== undefined ? routeToAdmin : false,
      updatedBy: req.user.id
    });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TRAVEL_ROUTING_SETTINGS_UPDATE',
      entityType: 'travel_routing_settings',
      entityId: String(settings.id || '1'),
      description: `${req.user.fullName} updated travel routing settings.`,
      metadata: { routeToSupervisor, routeToCeo, routeToAdmin },
      ipAddress: req.ip
    });

    res.json({ settings });
  } catch (error) {
    next(error);
  }
};

const getAllEmployeeRouting = async (req, res, next) => {
  try {
    const routing = await travelModel.getAllEmployeeRouting();
    res.json({ routing });
  } catch (error) {
    next(error);
  }
};

const getApproverForEmployee = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const approverId = await travelModel.getApproverForEmployee(employeeId);
    res.json({ approverId });
  } catch (error) {
    next(error);
  }
};

const addEmployeeRouting = async (req, res, next) => {
  try {
    const { employeeId, approverId } = req.body;

    if (!employeeId || !approverId) {
      return res.status(400).json({ message: 'Employee ID and Approver ID are required.' });
    }

    const routing = await travelModel.addEmployeeRouting({ employeeId, approverId });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TRAVEL_EMPLOYEE_ROUTING_ADD',
      entityType: 'travel_employee_routing',
      entityId: String(routing?.id || 'unknown'),
      description: `${req.user.fullName} added travel routing for employee ${employeeId} to approver ${approverId}.`,
      metadata: { employeeId, approverId },
      ipAddress: req.ip
    });

    res.json({ routing });
  } catch (error) {
    next(error);
  }
};

const removeEmployeeRouting = async (req, res, next) => {
  try {
    const { id } = req.params;

    await travelModel.removeEmployeeRouting(id);

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TRAVEL_EMPLOYEE_ROUTING_REMOVE',
      entityType: 'travel_employee_routing',
      entityId: String(id),
      description: `${req.user.fullName} removed travel routing ${id}.`,
      metadata: { id },
      ipAddress: req.ip
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const getPendingTravelRequestCount = async (req, res, next) => {
  try {
    const count = await travelModel.getPendingTravelRequestCountForUser(req.user.id, req.user.role);
    res.json({ count });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listTravelRequests,
  getTravelRequest,
  createTravelRequest,
  updateTravelRequest,
  cancelTravelRequest,
  decideTravelRequest,
  deleteTravelRequestPermanently,
  listTravelReceipts,
  getTravelReceipt,
  uploadTravelReceipt,
  updateTravelReceiptStatus,
  deleteTravelReceipt,
  downloadTravelReceipt,
  getTravelNotificationSettings,
  updateTravelNotificationSettings,
  getTravelRoutingSettings,
  updateTravelRoutingSettings,
  getAllEmployeeRouting,
  getApproverForEmployee,
  addEmployeeRouting,
  removeEmployeeRouting,
  getPendingTravelRequestCount
};
