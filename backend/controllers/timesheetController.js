const timesheetModel = require('../models/timesheetModel');
const userModel = require('../models/userModel');
const settingsModel = require('../models/settingsModel');
const { logAction } = require('../services/auditService');
const { sendTimesheetSubmittedEmail, sendTimesheetApprovedEmail, sendTimesheetRejectedEmail } = require('../services/mailService');

const calculateWorkingDays = (month, year) => {
  const date = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month - 1, day);
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }
  
  return workingDays;
};

const calculateTotalHours = (dailyEntries) => {
  let total = 0;
  Object.values(dailyEntries || {}).forEach(entry => {
    if (!entry) return;
    
    // Add main hours
    if (entry.hours !== '' && entry.hours !== null && entry.hours !== undefined) {
      total += parseFloat(entry.hours) || 0;
    }
    
    // Add partner hours
    if (entry.partnerHours) {
      Object.values(entry.partnerHours).forEach(hours => {
        if (hours !== '' && hours !== null && hours !== undefined) {
          total += parseFloat(hours) || 0;
        }
      });
    }
  });
  return total;
};

const calculateLevelOfEffort = (totalHours, month, year) => {
  const workingDays = calculateWorkingDays(month, year);
  const possibleHours = workingDays * 8;
  if (possibleHours === 0) return 0;
  return ((totalHours / possibleHours) * 100).toFixed(2);
};

const createTimesheet = async (req, res, next) => {
  try {
    const { month, year, partners, dailyEntries, totalHours, levelOfEffort, employeeSignature, supervisorSignature } = req.body;
    const userId = req.user.id;

    console.log('createTimesheet called with:', { userId, month, year, partnersCount: partners?.length });

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }

    const existing = await timesheetModel.getTimesheet({ 
      userId: parseInt(userId), 
      month: parseInt(month), 
      year: parseInt(year) 
    });
    
    console.log('Existing timesheet found:', existing ? `ID ${existing.id}` : 'None');
    
    if (existing) {
      // Update existing timesheet instead of creating new one
      const calculatedTotalHours = calculateTotalHours(dailyEntries);
      const calculatedLevelOfEffort = calculateLevelOfEffort(calculatedTotalHours, parseInt(month), parseInt(year));
      
      const updates = {
        partners: Array.isArray(partners) ? partners : [],
        dailyEntries: dailyEntries && typeof dailyEntries === 'object' ? dailyEntries : {},
        totalHours: parseFloat(totalHours) || 0,
        levelOfEffort: parseFloat(levelOfEffort) || 0,
        employeeSignature,
        supervisorSignature
      };
      
      console.log('Updating existing timesheet with:', updates);
      const updated = await timesheetModel.updateTimesheet(parseInt(existing.id), updates);
      console.log('Updated timesheet:', updated);
      
      await logAction({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: 'TIMESHEET_UPDATED',
        entityType: 'timesheet',
        entityId: String(existing.id),
        description: `${req.user.fullName} updated timesheet for ${month}/${year}`,
        metadata: { month, year },
        ipAddress: req.ip
      });

      return res.json({ timesheet: updated });
    }

    const calculatedTotalHours = calculateTotalHours(dailyEntries);
    const calculatedLevelOfEffort = calculateLevelOfEffort(calculatedTotalHours, month, year);

    const timesheet = await timesheetModel.createTimesheet({
      userId,
      month,
      year,
      partners,
      dailyEntries
    });

    console.log('Created new timesheet with ID:', timesheet.id);

    await timesheetModel.updateTimesheet(timesheet.id, {
      totalHours: totalHours || calculatedTotalHours,
      levelOfEffort: levelOfEffort || calculatedLevelOfEffort,
      employeeSignature,
      supervisorSignature
    });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TIMESHEET_CREATED',
      entityType: 'timesheet',
      entityId: String(timesheet.id),
      description: `${req.user.fullName} created timesheet for ${month}/${year}`,
      metadata: { month, year },
      ipAddress: req.ip
    });

    res.json({ timesheet });
  } catch (error) {
    console.error('Error in createTimesheet:', error);
    next(error);
  }
};

const getTimesheet = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Allow approvers (admin, ceo, or configured supervisor) to view submitted timesheets
    if (req.user.role === 'admin' || req.user.role === 'ceo') {
      const allTimesheets = await timesheetModel.listTimesheets({});
      const timesheetData = allTimesheets.find(t => String(t.id) === String(id));
      if (!timesheetData) {
        return res.status(404).json({ message: 'Timesheet not found' });
      }
      return res.json({ timesheet: timesheetData });
    }

    // Check if user is the configured supervisor for this timesheet
    const allTimesheets = await timesheetModel.listTimesheets({});
    const timesheetData = allTimesheets.find(t => String(t.id) === String(id));
    
    if (!timesheetData) {
      return res.status(404).json({ message: 'Timesheet not found' });
    }

    // Allow if user owns the timesheet or is the assigned supervisor
    if (String(timesheetData.user_id) === String(req.user.id) || 
        String(timesheetData.supervisor_id) === String(req.user.id)) {
      return res.json({ timesheet: timesheetData });
    }

    return res.status(404).json({ message: 'Timesheet not found' });
  } catch (error) {
    next(error);
  }
};

const updateTimesheet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { partners, dailyEntries, employeeSignature } = req.body;

    const timesheet = await timesheetModel.listTimesheets({ userId: req.user.id });
    const userTimesheet = timesheet.find(t => String(t.id) === String(id));

    if (!userTimesheet && req.user.role !== 'admin' && req.user.role !== 'ceo') {
      return res.status(404).json({ message: 'Timesheet not found' });
    }

    if (userTimesheet && userTimesheet.status !== 'draft') {
      return res.status(400).json({ message: 'Cannot update a submitted timesheet' });
    }

    const updates = {};

    if (partners !== undefined && partners !== null) updates.partners = Array.isArray(partners) ? partners : [];
    if (dailyEntries !== undefined && dailyEntries !== null) updates.dailyEntries = typeof dailyEntries === 'object' ? dailyEntries : {};
    if (employeeSignature) {
      updates.employeeSignature = String(employeeSignature);
      updates.employeeSignatureDate = new Date();
    }

    // Only calculate totalHours and levelOfEffort if dailyEntries is provided
    if (dailyEntries !== undefined && dailyEntries !== null) {
      const totalHours = calculateTotalHours(dailyEntries);
      const levelOfEffort = calculateLevelOfEffort(totalHours, userTimesheet.month, userTimesheet.year);
      updates.totalHours = parseFloat(totalHours);
      updates.levelOfEffort = parseFloat(levelOfEffort);
    }

    const updated = await timesheetModel.updateTimesheet(parseInt(id), updates);

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TIMESHEET_UPDATED',
      entityType: 'timesheet',
      entityId: String(id),
      description: `${req.user.fullName} updated timesheet`,
      ipAddress: req.ip
    });

    res.json({ timesheet: updated });
  } catch (error) {
    next(error);
  }
};

const submitTimesheet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { employeeSignature } = req.body;

    const timesheet = await timesheetModel.listTimesheets({ userId: req.user.id });
    const userTimesheet = timesheet.find(t => String(t.id) === String(id));

    if (!userTimesheet) {
      return res.status(404).json({ message: 'Timesheet not found' });
    }

    if (userTimesheet.status !== 'draft') {
      return res.status(400).json({ message: 'Timesheet has already been submitted' });
    }

    if (!employeeSignature) {
      return res.status(400).json({ message: 'Employee signature is required' });
    }

    // Get timesheet routing settings
    const settings = await settingsModel.getGlobal();
    const timesheetRouting = settings?.payload?.timesheet?.routing || {};
    const supervisorId = timesheetRouting[String(req.user.id)] || timesheetRouting.default || null;

    const updated = await timesheetModel.updateTimesheet(parseInt(id), {
      status: 'submitted',
      employeeSignature: String(employeeSignature),
      employeeSignatureDate: new Date(),
      supervisorId: supervisorId ? parseInt(supervisorId) : null,
      submittedAt: new Date()
    });

    // Send email to supervisor if configured
    if (supervisorId) {
      try {
        const supervisor = await userModel.findById(supervisorId);
        if (supervisor && supervisor.email) {
          await sendTimesheetSubmittedEmail({
            toEmail: supervisor.email,
            toName: supervisor.fullName,
            employeeName: req.user.fullName,
            period: `${updated.month}/${updated.year}`,
            timesheetId: id
          });
        }
      } catch (emailError) {
        console.error('Failed to send timesheet submission email:', emailError);
      }
    }

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TIMESHEET_SUBMITTED',
      entityType: 'timesheet',
      entityId: String(id),
      description: `${req.user.fullName} submitted timesheet for ${updated.month}/${updated.year}`,
      metadata: { supervisorId },
      ipAddress: req.ip
    });

    res.json({ timesheet: updated });
  } catch (error) {
    next(error);
  }
};

const approveTimesheet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { supervisorSignature, supervisorComment } = req.body;

    const timesheet = await timesheetModel.listTimesheets({});
    const targetTimesheet = timesheet.find(t => String(t.id) === String(id));

    if (!targetTimesheet) {
      return res.status(404).json({ message: 'Timesheet not found' });
    }

    if (targetTimesheet.status !== 'submitted') {
      return res.status(400).json({ message: 'Timesheet must be submitted before approval' });
    }

    if (!supervisorSignature) {
      return res.status(400).json({ message: 'Supervisor signature is required' });
    }

    const updated = await timesheetModel.updateTimesheet(id, {
      status: 'approved',
      supervisorId: req.user.id,
      supervisorSignature,
      supervisorSignatureDate: new Date(),
      supervisorComment,
      approvedAt: new Date()
    });

    // Send email to employee
    try {
      const employee = await userModel.findById(targetTimesheet.user_id);
      if (employee && employee.email) {
        await sendTimesheetApprovedEmail({
          toEmail: employee.email,
          toName: employee.fullName,
          period: `${updated.month}/${updated.year}`,
          approvedBy: req.user.fullName
        });
      }
    } catch (emailError) {
      console.error('Failed to send timesheet approval email:', emailError);
    }

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TIMESHEET_APPROVED',
      entityType: 'timesheet',
      entityId: String(id),
      description: `${req.user.fullName} approved timesheet for ${targetTimesheet.employee_name}`,
      ipAddress: req.ip
    });

    res.json({ timesheet: updated });
  } catch (error) {
    next(error);
  }
};

const rejectTimesheet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { supervisorComment } = req.body;

    const timesheet = await timesheetModel.listTimesheets({});
    const targetTimesheet = timesheet.find(t => String(t.id) === String(id));

    if (!targetTimesheet) {
      return res.status(404).json({ message: 'Timesheet not found' });
    }

    if (targetTimesheet.status !== 'submitted') {
      return res.status(400).json({ message: 'Timesheet must be submitted before rejection' });
    }

    const updated = await timesheetModel.updateTimesheet(id, {
      status: 'rejected',
      supervisorId: req.user.id,
      supervisorComment,
      rejectedAt: new Date()
    });

    // Send email to employee
    try {
      const employee = await userModel.findById(targetTimesheet.user_id);
      if (employee && employee.email) {
        await sendTimesheetRejectedEmail({
          toEmail: employee.email,
          toName: employee.fullName,
          period: `${updated.month}/${updated.year}`,
          rejectedBy: req.user.fullName,
          comment: supervisorComment
        });
      }
    } catch (emailError) {
      console.error('Failed to send timesheet rejection email:', emailError);
    }

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TIMESHEET_REJECTED',
      entityType: 'timesheet',
      entityId: String(id),
      description: `${req.user.fullName} rejected timesheet for ${targetTimesheet.employee_name}`,
      ipAddress: req.ip
    });

    res.json({ timesheet: updated });
  } catch (error) {
    next(error);
  }
};

const listTimesheets = async (req, res, next) => {
  try {
    const { status, month, year, supervisorId } = req.query;
    
    // Approvers (admin, ceo) can see all timesheets
    // Regular users can only see their own timesheets
    let filterStatus = status;
    let filterUserId = req.user.role === 'admin' || req.user.role === 'ceo' ? undefined : req.user.id;
    
    // For approvers without status filter, default to submitted
    if ((req.user.role === 'admin' || req.user.role === 'ceo') && !status) {
      filterStatus = 'submitted';
    }

    const timesheets = await timesheetModel.listTimesheets({
      userId: filterUserId,
      status: filterStatus,
      month,
      year,
      supervisorId
    });

    res.json({ timesheets });
  } catch (error) {
    next(error);
  }
};

const deleteTimesheet = async (req, res, next) => {
  try {
    const { id } = req.params;

    const timesheet = await timesheetModel.listTimesheets({ userId: req.user.id });
    const userTimesheet = timesheet.find(t => String(t.id) === String(id));

    if (!userTimesheet && req.user.role !== 'admin' && req.user.role !== 'ceo') {
      return res.status(404).json({ message: 'Timesheet not found' });
    }

    if (userTimesheet && userTimesheet.status !== 'draft') {
      return res.status(400).json({ message: 'Cannot delete a submitted timesheet' });
    }

    await timesheetModel.deleteTimesheet(id);

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TIMESHEET_DELETED',
      entityType: 'timesheet',
      entityId: String(id),
      description: `${req.user.fullName} deleted timesheet`,
      ipAddress: req.ip
    });

    res.json({ message: 'Timesheet deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTimesheet,
  getTimesheet,
  updateTimesheet,
  submitTimesheet,
  approveTimesheet,
  rejectTimesheet,
  listTimesheets,
  deleteTimesheet
};
