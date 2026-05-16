const fs = require('fs');
const auditModel = require('../models/auditModel');
const leaveModel = require('../models/leaveModel');
const userModel = require('../models/userModel');
const { logAction } = require('../services/auditService');
const { deleteStoredDocument, getRemoteDocumentUrl, isRemoteStoragePath, resolveDocumentPath, saveDocument } = require('../services/documentService');
const { sendLeaveApplicationEmail, sendLeaveDecisionEmail, sendSupervisorDecisionToCeoEmail } = require('../services/mailService');
const { countKenyaLeaveDays, formatDateOnly, getNextWorkingDate } = require('../services/leaveCalendarService');

const mapTimelineEvents = (request, auditTrail) => {
  const submittedEvent = auditTrail.find((entry) => entry.action === 'LEAVE_CREATE');
  const supervisorEvent = [...auditTrail].reverse().find((entry) => ['LEAVE_SUPERVISOR_APPROVE', 'LEAVE_SUPERVISOR_REJECT', 'LEAVE_SUPERVISOR_DECISION_REVISED'].includes(entry.action));
  const ceoEvent = [...auditTrail].reverse().find((entry) => ['LEAVE_CEO_APPROVE', 'LEAVE_CEO_REJECT', 'LEAVE_CEO_DECISION_REVISED', 'LEAVE_HR_APPROVE', 'LEAVE_HR_REJECT'].includes(entry.action) && ['ceo', 'admin'].includes(entry.actorRole));
  const isCeoSupervisor = request.supervisorApproverRole === 'ceo';
  const hasSupervisorStage = Boolean(
    request.requiresSupervisorReview
    || supervisorEvent
    || request.status === 'pending_supervisor'
    || request.supervisorApproverId
  ) && !isCeoSupervisor;

  const effectiveCeoEvent = isCeoSupervisor && !ceoEvent ? supervisorEvent : ceoEvent;
  const effectiveCeoActorName = isCeoSupervisor
    ? request.ceoApproverName || request.supervisorApproverName || effectiveCeoEvent?.actorName || null
    : request.ceoApproverName || request.hrApproverName || effectiveCeoEvent?.actorName || null;
  const effectiveCeoComment = isCeoSupervisor
    ? request.ceoComment || request.supervisorComment || request.hrComment || ''
    : request.ceoComment || request.hrComment || '';
  const effectiveCeoDecision = isCeoSupervisor && !ceoEvent
    ? (supervisorEvent?.action?.includes('APPROVE') ? 'approved' : supervisorEvent?.action?.includes('REJECT') ? 'rejected' : null)
    : (request.status === 'approved' ? 'approved' : request.status === 'rejected' ? 'rejected' : null);

  return {
    submitted: submittedEvent ? { label: 'Applied', time: submittedEvent.createdAt, actorName: submittedEvent.actorName } : { label: 'Applied', time: request.createdAt, actorName: request.employeeName },
    supervisor: hasSupervisorStage ? {
      label: 'Supervisor',
      time: supervisorEvent?.createdAt || null,
      actorName: request.supervisorApproverName || supervisorEvent?.actorName || null,
      comment: request.supervisorComment || '',
      decision: supervisorEvent?.action?.includes('APPROVE') ? 'approved' : supervisorEvent?.action?.includes('REJECT') ? 'rejected' : null
    } : null,
    ceo: {
      label: 'CEO',
      time: effectiveCeoEvent?.createdAt || null,
      actorName: effectiveCeoActorName,
      comment: effectiveCeoComment,
      decision: effectiveCeoDecision
    }
  };
};

const oversightRoles = ['admin', 'ceo', 'finance'];

const canViewOversightLeaveData = (role) => oversightRoles.includes(role);
const canAccessLeaveOverview = (role) => ['employee', 'supervisor', ...oversightRoles].includes(role);

const getLeaveOverviewUsers = async (currentUser) => {
  if (canViewOversightLeaveData(currentUser.role)) {
    return userModel.listAll();
  }

  if (currentUser.role === 'supervisor') {
    const [self, directReports] = await Promise.all([
      userModel.findById(currentUser.id),
      userModel.listAll({ supervisorId: currentUser.id })
    ]);

    return [self, ...directReports.filter((entry) => String(entry.id) !== String(currentUser.id))].filter(Boolean);
  }

  const self = await userModel.findById(currentUser.id);
  return self ? [self] : [];
};

const sendLeaveDecisionNotification = async ({ request, status, reviewerName, comment }) => {
  if (!request?.employeeEmail || !['approved', 'rejected', 'pending_ceo'].includes(status)) {
    return;
  }

  await sendLeaveDecisionEmail({
    toEmail: request.employeeEmail,
    toName: request.employeeName,
    leaveTypeLabel: request.leaveTypeLabel,
    startDate: request.startDate,
    endDate: request.endDate,
    daysRequested: request.daysRequested,
    status,
    reviewerName,
    comment,
    returnDate: status === 'approved' ? getNextWorkingDate(request.endDate) : null
  });
};

const getActiveCeoRecipients = async () => {
  const ceos = await userModel.listAll({ role: 'ceo' });
  return ceos.filter((entry) => entry.isActive && !entry.isDeleted);
};

const sendSupervisorDecisionToCeoNotification = async ({ request, supervisorName, decision, comment }) => {
  const recipients = await getActiveCeoRecipients();
  await sendSupervisorDecisionToCeoEmail({ recipients, request, supervisorName, decision, comment });
};

const getLeaveApplicationRecipients = async (request) => {
  if (request.status === 'pending_supervisor' && request.supervisorApproverId) {
    const supervisor = await userModel.findById(request.supervisorApproverId);
    return {
      recipients: supervisor && supervisor.isActive && !supervisor.isDeleted ? [supervisor] : [],
      stageLabel: 'supervisor review'
    };
  }

  if (request.status === 'pending_ceo') {
    const ceos = await userModel.listAll({ role: 'ceo' });
    return {
      recipients: ceos.filter((entry) => entry.isActive && !entry.isDeleted),
      stageLabel: 'CEO approval'
    };
  }

  if (request.status === 'pending_hr') {
    const [admins, ceos] = await Promise.all([
      userModel.listAll({ role: 'admin' }),
      userModel.listAll({ role: 'ceo' })
    ]);
    return {
      recipients: [...admins, ...ceos].filter((entry) => entry.isActive && !entry.isDeleted),
      stageLabel: 'approval'
    };
  }

  return { recipients: [], stageLabel: 'review' };
};

const sendLeaveApplicationNotification = async (request) => {
  const { recipients, stageLabel } = await getLeaveApplicationRecipients(request);
  await sendLeaveApplicationEmail({ recipients, request, stageLabel });
};

const deleteRequestPermanently = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await leaveModel.findRequestById(id);
    if (!request) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the IT Officer can delete leave requests.' });
    }

    if (!['approved', 'rejected'].includes(request.status)) {
      return res.status(400).json({ message: 'Only approved or disapproved leave requests can be deleted.' });
    }

    if (request.status === 'approved') {
      await leaveModel.revertApprovedDaysToBalance({
        userId: request.userId,
        leaveTypeId: request.leaveTypeId,
        daysRequested: request.daysRequested
      });
    }

    if (request.supportingDocumentPath) {
      await deleteStoredDocument({
        storagePath: request.supportingDocumentPath,
        storedName: request.supportingDocumentStoredName,
        mimeType: request.supportingDocumentMimeType
      });
    }

    await leaveModel.deleteRequest(id);

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'LEAVE_DELETE',
      entityType: 'leave_request',
      entityId: String(id),
      description: `${req.user.fullName} permanently deleted leave request ${id}.`,
      metadata: {},
      ipAddress: req.ip
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const sendRemoteDocument = async ({ res, url, mimeType, fileName }) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Unable to fetch remote supporting document.');
  }

  const arrayBuffer = await response.arrayBuffer();
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(Buffer.from(arrayBuffer));
};

const calculateRequestedDays = (startDate, endDate) => {
  const days = countKenyaLeaveDays(startDate, endDate);
  return days && days > 0 ? days : null;
};

const filterGenderRestrictedItems = (items, gender) => items.filter((item) => {
  if (item.code === 'maternity') {
    return gender === 'female';
  }

  if (item.code === 'paternity') {
    return gender === 'male';
  }

  return true;
});

const canAccessRequest = (currentUser, request) => {
  if (canViewOversightLeaveData(currentUser.role)) {
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

  if (request.status === 'pending_supervisor') {
    return true;
  }

  return request.status === 'pending_hr'
    && !request.supervisorApproverId
    && !request.hrApproverId
    && !request.ceoApproverId;
};

const getTodayDate = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const validateLeaveInputs = async ({ user, leaveTypeCode, startDate, endDate, hasSupportingDocument }) => {
  const leaveType = await leaveModel.findLeaveTypeByCode(leaveTypeCode);
  if (!leaveType) {
    return { status: 404, message: 'Leave type not found.' };
  }

  if (leaveType.requiresDocument && !hasSupportingDocument) {
    return { status: 400, message: `${leaveType.label} requires a supporting document.` };
  }

  if (leaveType.code === 'maternity' && user.gender !== 'female') {
    return { status: 400, message: 'Only female employees can apply for maternity leave.' };
  }

  if (leaveType.code === 'paternity' && user.gender !== 'male') {
    return { status: 400, message: 'Only male employees can apply for paternity leave.' };
  }

  const daysRequested = calculateRequestedDays(startDate, endDate);
  if (!daysRequested) {
    return { status: 400, message: 'Invalid leave dates.' };
  }


  const balances = filterGenderRestrictedItems(await leaveModel.getBalancesForUser(user.id), user.gender);
  const currentBalance = balances.find((entry) => entry.leaveTypeId === leaveType.id);

  if (!currentBalance) {
    return { status: 400, message: 'No active leave balance was found for this leave type.' };
  }

  if (daysRequested > currentBalance.defaultDays) {
    return { status: 400, message: `This request exceeds the allocated ${currentBalance.defaultDays} days for ${leaveType.label}.` };
  }

  if (daysRequested > currentBalance.balanceDays) {
    return { status: 400, message: `You only have ${currentBalance.balanceDays} remaining day(s) for ${leaveType.label}.` };
  }

  return { leaveType, daysRequested };
};

const buildLeaveRouting = async (user) => {
  const requesterIsSupervisor = await userModel.hasDirectReports(user.id);
  const supervisor = user.supervisorId ? await userModel.findById(user.supervisorId) : null;
  const shouldStartWithSupervisor = user.role === 'employee' && !requesterIsSupervisor && supervisor && supervisor.isActive && !supervisor.isDeleted;
  const supervisorIsCeo = shouldStartWithSupervisor && supervisor.role === 'ceo';

  return {
    requiresSupervisorReview: shouldStartWithSupervisor && !supervisorIsCeo,
    initialStatus: supervisorIsCeo ? 'pending_ceo' : shouldStartWithSupervisor ? 'pending_supervisor' : 'pending_hr',
    supervisorApproverId: shouldStartWithSupervisor && !supervisorIsCeo ? supervisor.id : null
  };
};

const mapSupportingDocumentPayload = async (userId, file) => {
  if (!file) {
    return {};
  }

  const { storedName, targetPath } = await saveDocument({
    userId: String(userId),
    folderType: 'other',
    file
  });

  return {
    supportingDocumentName: file.originalname,
    supportingDocumentStoredName: storedName,
    supportingDocumentMimeType: file.mimetype,
    supportingDocumentSize: file.size,
    supportingDocumentPath: targetPath
  };
};

const listLeaveTypes = async (req, res, next) => {
  try {
    const leaveTypes = await leaveModel.listLeaveTypes();
    const filteredLeaveTypes = filterGenderRestrictedItems(leaveTypes, req.user?.gender);
    res.json({ leaveTypes: filteredLeaveTypes });
  } catch (error) {
    next(error);
  }
};

const getBalances = async (req, res, next) => {
  try {
    const userId = req.query.userId && canViewOversightLeaveData(req.user.role)
      ? req.query.userId
      : req.user.id;
    const targetUser = String(userId) === String(req.user.id) ? req.user : await userModel.findById(userId);
    const balances = await leaveModel.getBalancesForUser(userId);
    res.json({ balances: filterGenderRestrictedItems(balances, targetUser?.gender) });
  } catch (error) {
    next(error);
  }
};

const listRequests = async (req, res, next) => {
  try {
    const requests = await leaveModel.listRequests({
      viewerId: req.user.id,
      userId: req.user.role === 'employee' ? req.user.id : canViewOversightLeaveData(req.user.role) ? req.query.userId : undefined,
      role: req.user.role,
      status: req.query.status
    });

    res.json({ requests });
  } catch (error) {
    next(error);
  }
};

const getLeaveOverview = async (req, res, next) => {
  try {
    if (!canAccessLeaveOverview(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to view the leave overview.' });
    }

    const now = new Date();
    const selectedYear = Math.max(2000, Math.min(2100, Number(req.query.year) || now.getFullYear()));
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;
    const today = formatDateOnly(now);
    const [users, approvedRequests, currentApprovedRequests] = await Promise.all([
      getLeaveOverviewUsers(req.user),
      leaveModel.listApprovedRequestsInRange({ startDate: yearStart, endDate: yearEnd }),
      leaveModel.listApprovedRequestsInRange({ startDate: today, endDate: today })
    ]);
    const scopedUserIds = new Set(users.map((entry) => String(entry.id)));

    const requestsByUserId = approvedRequests.filter((request) => scopedUserIds.has(String(request.userId))).reduce((accumulator, request) => {
      const key = String(request.userId);
      accumulator[key] = accumulator[key] || [];
      accumulator[key].push(request);
      return accumulator;
    }, {});

    const currentRequestsByUserId = currentApprovedRequests.filter((request) => scopedUserIds.has(String(request.userId))).reduce((accumulator, request) => {
      const key = String(request.userId);
      accumulator[key] = accumulator[key] || [];
      accumulator[key].push(request);
      return accumulator;
    }, {});

    const employees = users
      .filter((entry) => entry.isActive && !entry.isDeleted && entry.role !== 'ceo')
      .map((employee) => {
        const employeeRequests = (requestsByUserId[String(employee.id)] || []).sort((left, right) => String(left.startDate).localeCompare(String(right.startDate)));
        const currentLeave = (currentRequestsByUserId[String(employee.id)] || [])
          .sort((left, right) => String(left.startDate).localeCompare(String(right.startDate)))
          .find((request) => request.startDate <= today && request.endDate >= today) || null;

        return {
          id: employee.id,
          employeeNo: employee.employeeNo,
          fullName: employee.fullName,
          email: employee.email,
          joinedAt: employee.joinedAt,
          departmentName: employee.departmentName,
          positionTitle: employee.positionTitle,
          role: employee.role,
          roleTitle: employee.roleTitle,
          currentStatus: currentLeave ? 'At Leave' : 'At Work',
          currentLeave: currentLeave ? {
            id: currentLeave.id,
            leaveTypeLabel: currentLeave.leaveTypeLabel,
            startDate: currentLeave.startDate,
            endDate: currentLeave.endDate,
            daysRequested: currentLeave.daysRequested,
            returnDate: getNextWorkingDate(currentLeave.endDate)
          } : null,
          approvedRequests: employeeRequests,
          nextReturnDate: currentLeave ? getNextWorkingDate(currentLeave.endDate) : null
        };
      })
      .sort((left, right) => {
        if (left.currentStatus !== right.currentStatus) {
          return left.currentStatus === 'At Leave' ? -1 : 1;
        }
        return left.fullName.localeCompare(right.fullName);
      });

    res.json({ year: selectedYear, employees });
  } catch (error) {
    next(error);
  }
};

const getRequest = async (req, res, next) => {
  try {
    const request = await leaveModel.findRequestById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    if (!canAccessRequest(req.user, request)) {
      return res.status(403).json({ message: 'You do not have permission to view this leave request.' });
    }

    const auditTrail = await auditModel.listByEntity({ entityType: 'leave_request', entityId: req.params.id });
    res.json({ request: { ...request, timeline: mapTimelineEvents(request, auditTrail) } });
  } catch (error) {
    next(error);
  }
};

const createRequest = async (req, res, next) => {
  try {
    const { leaveTypeCode, startDate, endDate, reason } = req.body;

    if (req.user.role === 'ceo') {
      return res.status(403).json({ message: 'CEO accounts are limited to oversight and approvals only.' });
    }

    if (!leaveTypeCode || !startDate || !endDate) {
      return res.status(400).json({ message: 'Leave type, start date, and end date are required.' });
    }

    const validation = await validateLeaveInputs({ user: req.user, leaveTypeCode, startDate, endDate, hasSupportingDocument: Boolean(req.file) });
    if (validation.status) {
      return res.status(validation.status).json({ message: validation.message });
    }

    const { leaveType, daysRequested } = validation;
    const routing = await buildLeaveRouting(req.user);
    const supportingDocument = await mapSupportingDocumentPayload(req.user.id, req.file);

    const request = await leaveModel.createRequest({
      userId: req.user.id,
      leaveTypeId: leaveType.id,
      startDate,
      endDate,
      daysRequested,
      reason,
      status: routing.initialStatus,
      requiresSupervisorReview: routing.requiresSupervisorReview,
      supervisorApproverId: routing.supervisorApproverId,
      ...supportingDocument
    });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'LEAVE_CREATE',
      entityType: 'leave_request',
      entityId: String(request.id),
      description: `${req.user.fullName} submitted a leave request.`,
      metadata: { leaveTypeCode, daysRequested, initialStatus: routing.initialStatus },
      ipAddress: req.ip
    });

    sendLeaveApplicationNotification(request).catch((error) => console.error('Unable to send leave application email.', error.message));

    res.status(201).json({ request });
  } catch (error) {
    next(error);
  }
};

const updateRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { leaveTypeCode, startDate, endDate, reason } = req.body;
    const request = await leaveModel.findRequestById(id);

    if (!request) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    if (!canRequesterModify(req.user, request)) {
      return res.status(403).json({ message: 'This leave request can no longer be edited.' });
    }

    const validation = await validateLeaveInputs({
      user: req.user,
      leaveTypeCode: leaveTypeCode || request.leaveTypeCode,
      startDate: startDate || request.startDate,
      endDate: endDate || request.endDate,
      hasSupportingDocument: Boolean(req.file || request.supportingDocumentPath)
    });

    if (validation.status) {
      return res.status(validation.status).json({ message: validation.message });
    }

    const { leaveType, daysRequested } = validation;
    const routing = await buildLeaveRouting(req.user);
    const supportingDocument = await mapSupportingDocumentPayload(req.user.id, req.file);
    const updatedRequest = await leaveModel.updateRequestDetails({
      id,
      leaveTypeId: leaveType.id,
      startDate: startDate || request.startDate,
      endDate: endDate || request.endDate,
      daysRequested,
      reason: reason ?? request.reason,
      status: routing.initialStatus,
      requiresSupervisorReview: routing.requiresSupervisorReview,
      supervisorApproverId: routing.supervisorApproverId,
      ...supportingDocument
    });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'LEAVE_UPDATE',
      entityType: 'leave_request',
      entityId: String(id),
      description: `${req.user.fullName} updated leave request ${id}.`,
      metadata: { leaveTypeCode: leaveType.code, daysRequested },
      ipAddress: req.ip
    });

    res.json({ request: updatedRequest });
  } catch (error) {
    next(error);
  }
};

const cancelRequest = async (req, res, next) => {
  try {
    const request = await leaveModel.findRequestById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    if (!canRequesterModify(req.user, request)) {
      return res.status(403).json({ message: 'This leave request can no longer be cancelled.' });
    }

    if (request.supportingDocumentPath) {
      await deleteStoredDocument({
        storagePath: request.supportingDocumentPath,
        storedName: request.supportingDocumentStoredName,
        mimeType: request.supportingDocumentMimeType
      });
    }

    await leaveModel.deleteRequest(req.params.id);

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'LEAVE_CANCEL',
      entityType: 'leave_request',
      entityId: String(req.params.id),
      description: `${req.user.fullName} cancelled leave request ${req.params.id}.`,
      metadata: {},
      ipAddress: req.ip
    });

    res.json({ request: null });
  } catch (error) {
    next(error);
  }
};

const downloadSupportingDocument = async (req, res, next) => {
  try {
    const request = await leaveModel.findRequestById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    if (!request.supportingDocumentPath) {
      return res.status(404).json({ message: 'No supporting document is attached to this leave request.' });
    }

    if (!canAccessRequest(req.user, request)) {
      return res.status(403).json({ message: 'You do not have permission to access this document.' });
    }

    if (isRemoteStoragePath(request.supportingDocumentPath)) {
      await sendRemoteDocument({
        res,
        url: getRemoteDocumentUrl({
          storedName: request.supportingDocumentStoredName,
          mimeType: request.supportingDocumentMimeType,
          fileName: request.supportingDocumentName
        }),
        mimeType: request.supportingDocumentMimeType,
        fileName: request.supportingDocumentName
      });
      return;
    }

    const filePath = resolveDocumentPath(request.supportingDocumentPath);
    res.setHeader('Content-Type', request.supportingDocumentMimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${request.supportingDocumentName}"`);

    const stream = fs.createReadStream(filePath);
    stream.on('error', next);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

const decideRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { decision, comment } = req.body;
    const request = await leaveModel.findRequestById(id);

    if (!request) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ message: 'Decision must be approve or reject.' });
    }

    const normalizedComment = typeof comment === 'string' ? comment.trim() : '';

    if (request.status === 'pending_supervisor') {
      if (String(request.supervisorApproverId) !== String(req.user.id)) {
        return res.status(403).json({ message: 'Only the assigned supervisor can action this request.' });
      }

      const nextStatus = decision === 'approve' ? 'pending_ceo' : 'rejected';
      const updatedRequest = await leaveModel.updateRequestStatus({
        id,
        status: nextStatus,
        supervisorApproverId: req.user.id,
        supervisorComment: normalizedComment || null
      });

      await logAction({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: decision === 'approve' ? 'LEAVE_SUPERVISOR_APPROVE' : 'LEAVE_SUPERVISOR_REJECT',
        entityType: 'leave_request',
        entityId: String(id),
        description: `${req.user.fullName} ${decision}d leave request ${id} as supervisor.`,
        metadata: { comment: normalizedComment, nextStatus },
        ipAddress: req.ip
      });

      sendLeaveDecisionNotification({
        request: updatedRequest,
        status: nextStatus,
        reviewerName: req.user.fullName,
        comment: normalizedComment
      }).catch((error) => console.error('Unable to send leave decision email.', error.message));

      sendSupervisorDecisionToCeoNotification({
        request: updatedRequest,
        supervisorName: req.user.fullName,
        decision,
        comment: normalizedComment
      }).catch((error) => console.error('Unable to send supervisor decision email to CEO.', error.message));

      return res.json({ request: updatedRequest });
    }

    if ((req.user.role === 'admin' || req.user.role === 'ceo') && request.status === 'pending_hr') {
      const nextStatus = decision === 'approve' ? 'approved' : 'rejected';

      const updatedRequest = await leaveModel.updateRequestStatus({
        id,
        status: nextStatus,
        hrApproverId: req.user.role === 'admin' ? req.user.id : request.hrApproverId,
        hrComment: req.user.role === 'admin' ? normalizedComment || null : request.hrComment,
        ceoApproverId: req.user.role === 'ceo' ? req.user.id : request.ceoApproverId,
        ceoComment: req.user.role === 'ceo' ? normalizedComment || null : request.ceoComment
      });

      if (nextStatus === 'approved') {
        await leaveModel.applyApprovedDaysToBalance({
          userId: request.userId,
          leaveTypeId: request.leaveTypeId,
          daysRequested: request.daysRequested
        });
      }

      await logAction({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: decision === 'approve' ? 'LEAVE_HR_APPROVE' : 'LEAVE_HR_REJECT',
        entityType: 'leave_request',
        entityId: String(id),
        description: `${req.user.fullName} ${decision}d leave request ${id} during the operational review stage.`,
        metadata: { comment: normalizedComment },
        ipAddress: req.ip
      });

      sendLeaveDecisionNotification({
        request: updatedRequest,
        status: nextStatus,
        reviewerName: req.user.fullName,
        comment: normalizedComment
      }).catch((error) => console.error('Unable to send leave decision email.', error.message));

      return res.json({ request: updatedRequest });
    }

    if (
      req.user.role !== 'ceo'
      && request.supervisorApproverRole !== 'ceo'
      && ['pending_ceo', 'rejected'].includes(request.status)
      && String(request.supervisorApproverId) === String(req.user.id)
      && !request.ceoApproverId
    ) {
      const nextStatus = decision === 'approve' ? 'pending_ceo' : 'rejected';
      const updatedRequest = await leaveModel.updateRequestStatus({
        id,
        status: nextStatus,
        supervisorApproverId: req.user.id,
        supervisorComment: normalizedComment || null
      });

      await logAction({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: 'LEAVE_SUPERVISOR_DECISION_REVISED',
        entityType: 'leave_request',
        entityId: String(id),
        description: `${req.user.fullName} revised the supervisor decision for leave request ${id}.`,
        metadata: { decision, comment: normalizedComment, nextStatus },
        ipAddress: req.ip
      });

      sendLeaveDecisionNotification({
        request: updatedRequest,
        status: nextStatus,
        reviewerName: req.user.fullName,
        comment: normalizedComment
      }).catch((error) => console.error('Unable to send leave decision email.', error.message));

      sendSupervisorDecisionToCeoNotification({
        request: updatedRequest,
        supervisorName: req.user.fullName,
        decision,
        comment: normalizedComment
      }).catch((error) => console.error('Unable to send supervisor decision email to CEO.', error.message));

      return res.json({ request: updatedRequest });
    }

    if (req.user.role === 'ceo' && ['approved', 'rejected'].includes(request.status) && String(request.ceoApproverId) === String(req.user.id)) {
      if (request.status === 'approved' && decision === 'reject') {
        await leaveModel.revertApprovedDaysToBalance({
          userId: request.userId,
          leaveTypeId: request.leaveTypeId,
          daysRequested: request.daysRequested
        });
      }

      if (request.status === 'rejected' && decision === 'approve') {
        await leaveModel.applyApprovedDaysToBalance({
          userId: request.userId,
          leaveTypeId: request.leaveTypeId,
          daysRequested: request.daysRequested
        });
      }

      const updatedRequest = await leaveModel.updateRequestStatus({
        id,
        status: decision === 'approve' ? 'approved' : 'rejected',
        ceoApproverId: req.user.id,
        ceoComment: normalizedComment || null
      });

      await logAction({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: 'LEAVE_CEO_DECISION_REVISED',
        entityType: 'leave_request',
        entityId: String(id),
        description: `${req.user.fullName} revised the CEO decision for leave request ${id}.`,
        metadata: { decision, comment: normalizedComment },
        ipAddress: req.ip
      });

      sendLeaveDecisionNotification({
        request: updatedRequest,
        status: decision === 'approve' ? 'approved' : 'rejected',
        reviewerName: req.user.fullName,
        comment: normalizedComment
      }).catch((error) => console.error('Unable to send leave decision email.', error.message));

      return res.json({ request: updatedRequest });
    }

    if (req.user.role === 'ceo') {
      if (request.status !== 'pending_ceo') {
        return res.status(400).json({ message: 'Only CEO-pending requests can be actioned by the CEO.' });
      }

      const updatedRequest = await leaveModel.updateRequestStatus({
        id,
        status: decision === 'approve' ? 'approved' : 'rejected',
        ceoApproverId: req.user.id,
        ceoComment: normalizedComment || null
      });

      if (decision === 'approve') {
        await leaveModel.applyApprovedDaysToBalance({
          userId: request.userId,
          leaveTypeId: request.leaveTypeId,
          daysRequested: request.daysRequested
        });
      }

      await logAction({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: decision === 'approve' ? 'LEAVE_CEO_APPROVE' : 'LEAVE_CEO_REJECT',
        entityType: 'leave_request',
        entityId: String(id),
        description: `${req.user.fullName} ${decision}d leave request ${id}.`,
        metadata: { comment: normalizedComment },
        ipAddress: req.ip
      });

      sendLeaveDecisionNotification({
        request: updatedRequest,
        status: decision === 'approve' ? 'approved' : 'rejected',
        reviewerName: req.user.fullName,
        comment: normalizedComment
      }).catch((error) => console.error('Unable to send leave decision email.', error.message));

      return res.json({ request: updatedRequest });
    }

    return res.status(403).json({ message: 'Only assigned supervisors, Admin, and CEO can decide leave requests.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listLeaveTypes,
  getBalances,
  listRequests,
  getLeaveOverview,
  getRequest,
  createRequest,
  updateRequest,
  cancelRequest,
  downloadSupportingDocument,
  decideRequest,
  deleteRequestPermanently
};
