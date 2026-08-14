const { query } = require('../config/db');
const { logAction } = require('../services/auditService');

const escapePdfText = (value) => String(value ?? '').replace(/[\\()]/g, '\\$&');

const buildLeaveReportPdf = (payload) => {
  const statistics = payload.statistics || {};
  const leaveByType = payload.leaveByType || [];
  const leaveByDepartment = payload.leaveByDepartment || [];
  const employeeLeaveInfo = payload.employeeLeaveInfo || [];
  const employeesOnLeave = payload.employeesOnLeave || [];
  
  // Build PDF content
  const lines = [];
  
  // Title and header
  lines.push('KENYA RENEWABLE ENERGY ASSOCIATION (KEREA)');
  lines.push('EMPLOYEE LEAVE MANAGEMENT REPORT');
  lines.push('=====================================');
  lines.push(`Generated: ${new Date().toLocaleDateString()}`);
  lines.push('');
  
  // Executive Summary
  lines.push('EXECUTIVE SUMMARY');
  lines.push('-----------------');
  lines.push(`Total Employees: ${statistics.totalEmployees || 0}`);
  lines.push(`Total Leave Applications: ${statistics.totalLeaveApplications || 0}`);
  lines.push(`Approved Leaves: ${statistics.approvedLeaves || 0}`);
  lines.push(`Pending Leaves: ${statistics.pendingLeaves || 0}`);
  lines.push(`Rejected Leaves: ${statistics.rejectedLeaves || 0}`);
  lines.push(`Cancelled Leaves: ${statistics.cancelledLeaves || 0}`);
  lines.push(`Employees Currently on Leave: ${statistics.employeesOnLeave || 0}`);
  lines.push(`Total Leave Days Taken: ${statistics.totalLeaveDaysTaken || 0}`);
  lines.push('');
  
  // Leave Type Distribution
  lines.push('LEAVE TYPE DISTRIBUTION');
  lines.push('-----------------------');
  const maxTypeDays = Math.max(...leaveByType.map(d => d.days_taken), 1);
  leaveByType.forEach((item) => {
    const barLength = Math.floor((item.days_taken / maxTypeDays) * 30);
    const bar = '█'.repeat(barLength);
    lines.push(`${item.leave_type}: ${item.days_taken} days ${bar}`);
  });
  lines.push('');
  
  // Department Distribution
  lines.push('DEPARTMENT DISTRIBUTION');
  lines.push('-----------------------');
  const maxDeptDays = Math.max(...leaveByDepartment.map(d => d.days_taken), 1);
  leaveByDepartment.forEach((item) => {
    const barLength = Math.floor((item.days_taken / maxDeptDays) * 30);
    const bar = '█'.repeat(barLength);
    lines.push(`${item.department}: ${item.days_taken} days ${bar}`);
  });
  lines.push('');
  
  // Employees Currently on Leave
  if (employeesOnLeave.length > 0) {
    lines.push('EMPLOYEES CURRENTLY ON LEAVE');
    lines.push('----------------------------');
    employeesOnLeave.forEach((emp) => {
      lines.push(`- ${emp.employee_name} (${emp.employee_no})`);
      lines.push(`  ${emp.leave_type}: ${emp.start_date} to ${emp.end_date} (${emp.days_requested} days)`);
    });
    lines.push('');
  }
  
  // Employee Leave Information
  lines.push('EMPLOYEE LEAVE INFORMATION');
  lines.push('--------------------------');
  lines.push('');
  
  employeeLeaveInfo.slice(0, 100).forEach((emp) => {
    lines.push(`${emp.employee_name} (${emp.employee_no})`);
    lines.push(`  Department: ${emp.department}`);
    lines.push(`  Leave Type: ${emp.leave_type}`);
    lines.push(`  Entitlement: ${emp.leave_entitlement} days`);
    lines.push(`  Days Taken: ${emp.days_taken} days`);
    lines.push(`  Remaining: ${emp.remaining_days} days`);
    lines.push(`  Pending: ${emp.pending_days} days`);
    lines.push(`  Status: ${emp.current_status || 'N/A'}`);
    lines.push('');
  });
  
  if (employeeLeaveInfo.length > 100) {
    lines.push(`... and ${employeeLeaveInfo.length - 100} more employees`);
    lines.push('');
  }
  
  // Footer
  lines.push('=====================================');
  lines.push('End of Report');
  lines.push('KEREA HRMS - Leave Management System');

  const text = lines.map((line) => `(${escapePdfText(line)}) Tj T*`).join('\n');
  const stream = `BT /F1 9 Tf 40 790 Td 11 TL\n${text}\nET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
};

const getLeaveReportData = async (req, res, next) => {
  try {
    const { startDate, endDate, employeeId, departmentId, leaveTypeId, status } = req.query;
    
    // Build WHERE clauses for filters
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    if (startDate) {
      conditions.push(`lr.start_date >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      conditions.push(`lr.end_date <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }
    
    if (employeeId) {
      conditions.push(`lr.user_id = $${paramIndex}`);
      params.push(employeeId);
      paramIndex++;
    }
    
    if (departmentId) {
      conditions.push(`u.department_id = $${paramIndex}`);
      params.push(departmentId);
      paramIndex++;
    }
    
    if (leaveTypeId) {
      conditions.push(`lr.leave_type_id = $${paramIndex}`);
      params.push(leaveTypeId);
      paramIndex++;
    }
    
    if (status) {
      conditions.push(`lr.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Get summary statistics
    const statsResult = await query(
      `
        SELECT
          COUNT(DISTINCT u.id) as total_employees,
          COUNT(lr.id) as total_leave_applications,
          COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_leaves,
          COUNT(CASE WHEN lr.status LIKE 'pending%' THEN 1 END) as pending_leaves,
          COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected_leaves,
          COUNT(CASE WHEN lr.status = 'cancelled' THEN 1 END) as cancelled_leaves,
          COUNT(CASE WHEN lr.status = 'approved' AND lr.start_date <= CURRENT_DATE AND lr.end_date >= CURRENT_DATE THEN 1 END) as employees_on_leave,
          COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END), 0) as total_leave_days_taken
        FROM users u
        LEFT JOIN leave_requests lr ON lr.user_id = u.id
        ${whereClause}
      `,
      params
    );
    
    const stats = statsResult.rows[0];
    
    // Get leave days by type
    const leaveByTypeResult = await query(
      `
        SELECT
          lt.label as leave_type,
          COUNT(lr.id) as request_count,
          COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END), 0) as days_taken
        FROM leave_types lt
        LEFT JOIN leave_requests lr ON lr.leave_type_id = lt.id
        LEFT JOIN users u ON u.id = lr.user_id
        ${whereClause}
        GROUP BY lt.id, lt.label
        ORDER BY days_taken DESC
      `,
      params
    );
    
    // Get leave utilization by department
    const leaveByDeptResult = await query(
      `
        SELECT
          COALESCE(d.name, 'Unassigned') as department,
          COUNT(lr.id) as request_count,
          COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END), 0) as days_taken
        FROM departments d
        LEFT JOIN users u ON u.department_id = d.id
        LEFT JOIN leave_requests lr ON lr.user_id = u.id
        ${whereClause}
        GROUP BY d.id, d.name
        ORDER BY days_taken DESC
      `,
      params
    );
    
    // Get monthly leave trends
    const monthlyTrendsResult = await query(
      `
        SELECT
          TO_CHAR(lr.start_date, 'YYYY-MM') as month,
          COUNT(lr.id) as request_count,
          COALESCE(SUM(lr.days_requested), 0) as days_taken
        FROM leave_requests lr
        LEFT JOIN users u ON u.id = lr.user_id
        ${whereClause}
        GROUP BY TO_CHAR(lr.start_date, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      `,
      params
    );
    
    // Get employee leave information
    const employeeLeaveResult = await query(
      `
        SELECT
          u.id as employee_id,
          CONCAT(u.first_name, ' ', u.last_name) as employee_name,
          u.employee_no,
          COALESCE(d.name, 'Unassigned') as department,
          lt.label as leave_type,
          COALESCE(lt.default_days, 0) as leave_entitlement,
          COALESCE(lb.balance_days, 0) as remaining_days,
          COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END), 0) as days_taken,
          COUNT(CASE WHEN lr.status LIKE 'pending%' THEN 1 END) as pending_days,
          COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_requests,
          MAX(lr.status) as current_status
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN leave_balances lb ON lb.user_id = u.id
        LEFT JOIN leave_types lt ON lt.id = lb.leave_type_id
        LEFT JOIN leave_requests lr ON lr.user_id = u.id AND lr.leave_type_id = lt.id
        WHERE u.is_deleted = FALSE
        ${conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''}
        GROUP BY u.id, u.first_name, u.last_name, u.employee_no, d.name, lt.label, lt.default_days, lb.balance_days
        ORDER BY u.last_name, u.first_name
      `,
      params
    );
    
    // Get employees currently on leave
    const onLeaveResult = await query(
      `
        SELECT
          CONCAT(u.first_name, ' ', u.last_name) as employee_name,
          u.employee_no,
          lt.label as leave_type,
          lr.start_date,
          lr.end_date,
          lr.days_requested
        FROM leave_requests lr
        INNER JOIN users u ON u.id = lr.user_id
        INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE lr.status = 'approved'
          AND lr.start_date <= CURRENT_DATE
          AND lr.end_date >= CURRENT_DATE
          AND u.is_deleted = FALSE
        ORDER BY lr.end_date ASC
      `
    );
    
    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'LEAVE_REPORT_GENERATED',
      entityType: 'leave_report',
      entityId: 'all',
      description: `${req.user.fullName} generated a leave report.`,
      metadata: { filters: { startDate, endDate, employeeId, departmentId, leaveTypeId, status } },
      ipAddress: req.ip
    });
    
    res.json({
      statistics: {
        totalEmployees: parseInt(stats.total_employees) || 0,
        totalLeaveApplications: parseInt(stats.total_leave_applications) || 0,
        approvedLeaves: parseInt(stats.approved_leaves) || 0,
        pendingLeaves: parseInt(stats.pending_leaves) || 0,
        rejectedLeaves: parseInt(stats.rejected_leaves) || 0,
        cancelledLeaves: parseInt(stats.cancelled_leaves) || 0,
        employeesOnLeave: parseInt(stats.employees_on_leave) || 0,
        totalLeaveDaysTaken: parseFloat(stats.total_leave_days_taken) || 0
      },
      leaveByType: leaveByTypeResult.rows,
      leaveByDepartment: leaveByDeptResult.rows,
      monthlyTrends: monthlyTrendsResult.rows,
      employeeLeaveInfo: employeeLeaveResult.rows,
      employeesOnLeave: onLeaveResult.rows
    });
  } catch (error) {
    next(error);
  }
};

const getLeaveReportFilters = async (req, res, next) => {
  try {
    // Get departments
    const departmentsResult = await query(
      `SELECT id, name FROM departments ORDER BY name`
    );
    
    // Get leave types
    const leaveTypesResult = await query(
      `SELECT id, label FROM leave_types WHERE is_active = TRUE ORDER BY label`
    );
    
    // Get employees
    const employeesResult = await query(
      `SELECT id, CONCAT(first_name, ' ', last_name) as name, employee_no FROM users WHERE is_deleted = FALSE ORDER BY last_name, first_name`
    );
    
    res.json({
      departments: departmentsResult.rows,
      leaveTypes: leaveTypesResult.rows,
      employees: employeesResult.rows,
      statuses: [
        { value: 'approved', label: 'Approved' },
        { value: 'pending_supervisor', label: 'Pending Supervisor' },
        { value: 'pending_ceo', label: 'Pending CEO' },
        { value: 'rejected', label: 'Rejected' },
        { value: 'cancelled', label: 'Cancelled' }
      ]
    });
  } catch (error) {
    next(error);
  }
};

const exportLeaveReportPdf = async (req, res, next) => {
  try {
    const { startDate, endDate, employeeId, departmentId, leaveTypeId, status } = req.query;
    
    // Build WHERE clauses for filters
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    if (startDate) {
      conditions.push(`lr.start_date >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      conditions.push(`lr.end_date <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }
    
    if (employeeId) {
      conditions.push(`lr.user_id = $${paramIndex}`);
      params.push(employeeId);
      paramIndex++;
    }
    
    if (departmentId) {
      conditions.push(`u.department_id = $${paramIndex}`);
      params.push(departmentId);
      paramIndex++;
    }
    
    if (leaveTypeId) {
      conditions.push(`lr.leave_type_id = $${paramIndex}`);
      params.push(leaveTypeId);
      paramIndex++;
    }
    
    if (status) {
      conditions.push(`lr.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Get summary statistics
    const statsResult = await query(
      `
        SELECT
          COUNT(DISTINCT u.id) as total_employees,
          COUNT(lr.id) as total_leave_applications,
          COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_leaves,
          COUNT(CASE WHEN lr.status LIKE 'pending%' THEN 1 END) as pending_leaves,
          COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected_leaves,
          COUNT(CASE WHEN lr.status = 'cancelled' THEN 1 END) as cancelled_leaves,
          COUNT(CASE WHEN lr.status = 'approved' AND lr.start_date <= CURRENT_DATE AND lr.end_date >= CURRENT_DATE THEN 1 END) as employees_on_leave,
          COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END), 0) as total_leave_days_taken
        FROM users u
        LEFT JOIN leave_requests lr ON lr.user_id = u.id
        ${whereClause}
      `,
      params
    );
    
    const stats = statsResult.rows[0];
    
    // Get leave days by type
    const leaveByTypeResult = await query(
      `
        SELECT
          lt.label as leave_type,
          COUNT(lr.id) as request_count,
          COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END), 0) as days_taken
        FROM leave_types lt
        LEFT JOIN leave_requests lr ON lr.leave_type_id = lt.id
        LEFT JOIN users u ON u.id = lr.user_id
        ${whereClause}
        GROUP BY lt.id, lt.label
        ORDER BY days_taken DESC
      `,
      params
    );
    
    // Get leave utilization by department
    const leaveByDeptResult = await query(
      `
        SELECT
          COALESCE(d.name, 'Unassigned') as department,
          COUNT(lr.id) as request_count,
          COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END), 0) as days_taken
        FROM departments d
        LEFT JOIN users u ON u.department_id = d.id
        LEFT JOIN leave_requests lr ON lr.user_id = u.id
        ${whereClause}
        GROUP BY d.id, d.name
        ORDER BY days_taken DESC
      `,
      params
    );
    
    // Get employee leave information
    const employeeLeaveResult = await query(
      `
        SELECT
          u.id as employee_id,
          CONCAT(u.first_name, ' ', u.last_name) as employee_name,
          u.employee_no,
          COALESCE(d.name, 'Unassigned') as department,
          lt.label as leave_type,
          COALESCE(lt.default_days, 0) as leave_entitlement,
          COALESCE(lb.balance_days, 0) as remaining_days,
          COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END), 0) as days_taken,
          COUNT(CASE WHEN lr.status LIKE 'pending%' THEN 1 END) as pending_days,
          COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_requests,
          MAX(lr.status) as current_status
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN leave_balances lb ON lb.user_id = u.id
        LEFT JOIN leave_types lt ON lt.id = lb.leave_type_id
        LEFT JOIN leave_requests lr ON lr.user_id = u.id AND lr.leave_type_id = lt.id
        WHERE u.is_deleted = FALSE
        ${conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''}
        GROUP BY u.id, u.first_name, u.last_name, u.employee_no, d.name, lt.label, lt.default_days, lb.balance_days
        ORDER BY u.last_name, u.first_name
      `,
      params
    );
    
    // Get employees currently on leave
    const onLeaveResult = await query(
      `
        SELECT
          CONCAT(u.first_name, ' ', u.last_name) as employee_name,
          u.employee_no,
          lt.label as leave_type,
          lr.start_date,
          lr.end_date,
          lr.days_requested
        FROM leave_requests lr
        INNER JOIN users u ON u.id = lr.user_id
        INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE lr.status = 'approved'
          AND lr.start_date <= CURRENT_DATE
          AND lr.end_date >= CURRENT_DATE
          AND u.is_deleted = FALSE
        ORDER BY lr.end_date ASC
      `
    );
    
    const payload = {
      statistics: {
        totalEmployees: parseInt(stats.total_employees) || 0,
        totalLeaveApplications: parseInt(stats.total_leave_applications) || 0,
        approvedLeaves: parseInt(stats.approved_leaves) || 0,
        pendingLeaves: parseInt(stats.pending_leaves) || 0,
        rejectedLeaves: parseInt(stats.rejected_leaves) || 0,
        cancelledLeaves: parseInt(stats.cancelled_leaves) || 0,
        employeesOnLeave: parseInt(stats.employees_on_leave) || 0,
        totalLeaveDaysTaken: parseFloat(stats.total_leave_days_taken) || 0
      },
      leaveByType: leaveByTypeResult.rows,
      leaveByDepartment: leaveByDeptResult.rows,
      employeeLeaveInfo: employeeLeaveResult.rows,
      employeesOnLeave: onLeaveResult.rows
    };
    
    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'LEAVE_REPORT_PDF_EXPORT',
      entityType: 'leave_report',
      entityId: 'all',
      description: `${req.user.fullName} exported leave report as PDF.`,
      metadata: { filters: { startDate, endDate, employeeId, departmentId, leaveTypeId, status } },
      ipAddress: req.ip
    });
    
    const pdfBuffer = buildLeaveReportPdf(payload);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="kerea-leave-report-${new Date().toISOString().slice(0, 10)}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLeaveReportData,
  getLeaveReportFilters,
  exportLeaveReportPdf
};
