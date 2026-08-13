const fs = require('fs');
const auditModel = require('../models/auditModel');
const travelModel = require('../models/travelModel');
const userModel = require('../models/userModel');
const { logAction } = require('../services/auditService');
const { deleteStoredDocument, getRemoteDocumentUrl, isRemoteStoragePath, resolveDocumentPath, saveDocument } = require('../services/documentService');
const { sendTravelReceiptNotificationEmail } = require('../services/mailService');

const oversightRoles = ['admin', 'ceo', 'finance', 'supervisor'];

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
      userId: req.user.role === 'employee' ? req.user.id : canViewOversightTravelData(req.user.role) ? req.query.userId : undefined,
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
    const { travelType, startDate, endDate, origin, destination, reason, estimatedCost } = req.body;

    if (!startDate || !endDate || !origin || !destination || !reason) {
      return res.status(400).json({ message: 'Start date, end date, origin, destination, and reason are required.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({ message: 'Start date must be before or equal to end date.' });
    }

    const request = await travelModel.createTravelRequest({
      userId: req.user.id,
      travelType: travelType || 'booking',
      startDate,
      endDate,
      origin,
      destination,
      reason,
      estimatedCost: estimatedCost || null
    });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TRAVEL_CREATE',
      entityType: 'travel_request',
      entityId: String(request.id),
      description: `${req.user.fullName} submitted a travel request.`,
      metadata: { travelType, origin, destination, startDate, endDate },
      ipAddress: req.ip
    });

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

    if (travelRequest.status !== 'approved') {
      return res.status(400).json({ message: 'Receipts can only be uploaded for approved travel requests.' });
    }

    const { storedName, targetPath } = await saveDocument({
      userId: String(req.user.id),
      folderType: 'travel_receipts',
      file: req.file
    });

    const receipt = await travelModel.createTravelReceipt({
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
    const { notifyFinance, notifyAdmin, notifySupervisor, notifyCeo, customRecipients } = req.body;

    const settings = await travelModel.updateTravelNotificationSettings({
      notifyFinance: notifyFinance !== undefined ? notifyFinance : true,
      notifyAdmin: notifyAdmin !== undefined ? notifyAdmin : true,
      notifySupervisor: notifySupervisor !== undefined ? notifySupervisor : true,
      notifyCeo: notifyCeo !== undefined ? notifyCeo : false,
      customRecipients: customRecipients || [],
      updatedBy: req.user.id
    });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TRAVEL_NOTIFICATION_SETTINGS_UPDATE',
      entityType: 'travel_notification_settings',
      entityId: String(settings.id || '1'),
      description: `${req.user.fullName} updated travel notification settings.`,
      metadata: { notifyFinance, notifyAdmin, notifySupervisor, notifyCeo, customRecipients },
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
  addEmployeeRouting,
  removeEmployeeRouting
};
