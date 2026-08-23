const { query } = require('../config/db');
const { logAction } = require('../services/auditService');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const escapePdfText = (value) => String(value ?? '').replace(/[\\()]/g, '\\$&');

const buildLeaveReportPdf = async (payload) => {
  const statistics = payload.statistics || {};
  const leaveByType = payload.leaveByType || [];
  const leaveByDepartment = payload.leaveByDepartment || [];
  const employeeLeaveInfo = payload.employeeLeaveInfo || [];
  const employeesOnLeave = payload.employeesOnLeave || [];
  
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const { width, height } = page.getSize();
  let y = height - 50;
  
  // Professional color scheme
  const primaryColor = rgb(0.13, 0.35, 0.18); // Dark green
  const secondaryColor = rgb(0.09, 0.25, 0.13); // Even darker green
  const accentColor = rgb(0.45, 0.75, 0.55); // Medium green
  const lightAccent = rgb(0.85, 0.95, 0.9); // Very light green
  const textColor = rgb(0.15, 0.2, 0.3); // Dark blue-gray
  const lightGray = rgb(0.96, 0.97, 0.98);
  const borderColor = rgb(0.85, 0.85, 0.9);
  const white = rgb(1, 1, 1);
  
  // Header section with gradient-like background
  page.drawRectangle({
    x: 0,
    y: height - 90,
    width: width,
    height: 90,
    color: primaryColor,
  });
  
  // Decorative line
  page.drawRectangle({
    x: 0,
    y: height - 90,
    width: width,
    height: 3,
    color: accentColor,
  });
  
  // Company name
  page.drawText('KENYA RENEWABLE ENERGY ASSOCIATION', {
    x: 50,
    y: height - 25,
    size: 16,
    font: fontBold,
    color: white,
  });
  
  // Report title
  page.drawText('EMPLOYEE LEAVE MANAGEMENT REPORT', {
    x: 50,
    y: height - 50,
    size: 14,
    font: fontBold,
    color: lightAccent,
  });
  
  // Date
  page.drawText(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, {
    x: 50,
    y: height - 75,
    size: 10,
    font: font,
    color: lightAccent,
  });
  
  y -= 50;
  
  // Executive Summary Section with better styling
  page.drawRectangle({
    x: 40,
    y: y - 15,
    width: width - 80,
    height: 160,
    color: white,
    borderColor: primaryColor,
    borderWidth: 2,
  });
  
  // Section header background
  page.drawRectangle({
    x: 40,
    y: y - 15,
    width: width - 80,
    height: 30,
    color: lightAccent,
  });
  
  page.drawText('EXECUTIVE SUMMARY', {
    x: 50,
    y: y - 5,
    size: 12,
    font: fontBold,
    color: primaryColor,
  });
  
  const summaryData = [
    `Total Employees: ${statistics.totalEmployees || 0}`,
    `Total Leave Applications: ${statistics.totalLeaveApplications || 0}`,
    `Approved Leaves: ${statistics.approvedLeaves || 0}`,
    `Pending Leaves: ${statistics.pendingLeaves || 0}`,
    `Rejected Leaves: ${statistics.rejectedLeaves || 0}`,
    `Cancelled Leaves: ${statistics.cancelledLeaves || 0}`,
    `Employees Currently on Leave: ${statistics.employeesOnLeave || 0}`,
    `Total Leave Days Taken: ${statistics.totalLeaveDaysTaken || 0}`,
  ];
  
  summaryData.forEach((text, index) => {
    const rowY = y - 55 - (index * 14);
    page.drawText(text, {
      x: 50,
      y: rowY,
      size: 9,
      font: font,
      color: textColor,
    });
    
    // Add subtle row divider
    if (index < summaryData.length - 1) {
      page.drawLine({
        start: { x: 50, y: rowY - 6 },
        end: { x: width - 50, y: rowY - 6 },
        thickness: 0.5,
        color: borderColor,
      });
    }
  });
  
  y -= 190;
  
  // Leave Type Distribution Section
  page.drawRectangle({
    x: 40,
    y: y - 15,
    width: width - 80,
    height: 140,
    color: white,
    borderColor: primaryColor,
    borderWidth: 2,
  });
  
  page.drawRectangle({
    x: 40,
    y: y - 15,
    width: width - 80,
    height: 30,
    color: lightAccent,
  });
  
  page.drawText('LEAVE TYPE DISTRIBUTION', {
    x: 50,
    y: y - 5,
    size: 12,
    font: fontBold,
    color: primaryColor,
  });
  
  const maxTypeDays = Math.max(...leaveByType.map(d => d.days_taken), 1);
  leaveByType.slice(0, 5).forEach((item, index) => {
    const barWidth = ((item.days_taken / maxTypeDays) * 180);
    const barY = y - 45 - (index * 22);
    
    // Label with better formatting
    page.drawText(`${item.leave_type}:`, {
      x: 50,
      y: barY + 8,
      size: 9,
      font: fontBold,
      color: textColor,
    });
    
    page.drawText(`${item.days_taken} days`, {
      x: 50,
      y: barY - 2,
      size: 8,
      font: font,
      color: textColor,
    });
    
    // Bar background with rounded corners effect
    page.drawRectangle({
      x: 200,
      y: barY - 2,
      width: 180,
      height: 12,
      color: lightGray,
    });
    
    // Bar with gradient-like color
    page.drawRectangle({
      x: 200,
      y: barY - 2,
      width: barWidth,
      height: 12,
      color: accentColor,
    });
  });
  
  y -= 170;
  
  // Department Distribution Section
  page.drawRectangle({
    x: 40,
    y: y - 15,
    width: width - 80,
    height: 140,
    color: white,
    borderColor: primaryColor,
    borderWidth: 2,
  });
  
  page.drawRectangle({
    x: 40,
    y: y - 15,
    width: width - 80,
    height: 30,
    color: lightAccent,
  });
  
  page.drawText('DEPARTMENT DISTRIBUTION', {
    x: 50,
    y: y - 5,
    size: 12,
    font: fontBold,
    color: primaryColor,
  });
  
  const maxDeptDays = Math.max(...leaveByDepartment.map(d => d.days_taken), 1);
  leaveByDepartment.slice(0, 5).forEach((item, index) => {
    const barWidth = ((item.days_taken / maxDeptDays) * 180);
    const barY = y - 45 - (index * 22);
    
    // Label
    page.drawText(`${item.department}:`, {
      x: 50,
      y: barY + 8,
      size: 9,
      font: fontBold,
      color: textColor,
    });
    
    page.drawText(`${item.days_taken} days`, {
      x: 50,
      y: barY - 2,
      size: 8,
      font: font,
      color: textColor,
    });
    
    // Bar background
    page.drawRectangle({
      x: 200,
      y: barY - 2,
      width: 180,
      height: 12,
      color: lightGray,
    });
    
    // Bar
    page.drawRectangle({
      x: 200,
      y: barY - 2,
      width: barWidth,
      height: 12,
      color: primaryColor,
    });
  });
  
  y -= 170;
  
  // Employees Currently on Leave Section
  if (employeesOnLeave.length > 0) {
    const sectionHeight = 90 + (employeesOnLeave.length * 25);
    page.drawRectangle({
      x: 40,
      y: y - 15,
      width: width - 80,
      height: sectionHeight,
      color: white,
      borderColor: primaryColor,
      borderWidth: 2,
    });
    
    page.drawRectangle({
      x: 40,
      y: y - 15,
      width: width - 80,
      height: 30,
      color: lightAccent,
    });
    
    page.drawText('EMPLOYEES CURRENTLY ON LEAVE', {
      x: 50,
      y: y - 5,
      size: 12,
      font: fontBold,
      color: primaryColor,
    });
    
    employeesOnLeave.slice(0, 3).forEach((emp, index) => {
      const empY = y - 50 - (index * 25);
      
      // Employee name with bullet
      page.drawText(`• ${emp.employee_name} (${emp.employee_no})`, {
        x: 50,
        y: empY,
        size: 9,
        font: fontBold,
        color: textColor,
      });
      
      // Leave details
      page.drawText(`${emp.leave_type}: ${emp.start_date} to ${emp.end_date} (${emp.days_requested} days)`, {
        x: 70,
        y: empY - 12,
        size: 8,
        font: font,
        color: textColor,
      });
    });
    
    y -= sectionHeight + 20;
  }
  
  // Employee Leave Information Section
  page.drawText('EMPLOYEE LEAVE INFORMATION', {
    x: 50,
    y: y - 5,
    size: 12,
    font: fontBold,
    color: primaryColor,
  });
  
  y -= 20;
  
  employeeLeaveInfo.slice(0, 12).forEach((emp, index) => {
    if (y < 60) {
      // Add new page if running out of space
      const newPage = pdfDoc.addPage([612, 792]);
      y = newPage.getHeight() - 50;
      
      // Add header to new page
      newPage.drawRectangle({
        x: 0,
        y: newPage.getHeight() - 50,
        width: width,
        height: 50,
        color: primaryColor,
      });
      
      newPage.drawText('EMPLOYEE LEAVE INFORMATION (Continued)', {
        x: 50,
        y: newPage.getHeight() - 30,
        size: 12,
        font: fontBold,
        color: white,
      });
      
      y -= 30;
    }
    
    // Employee card with better styling
    page.drawRectangle({
      x: 40,
      y: y - 50,
      width: width - 80,
      height: 50,
      color: white,
      borderColor: borderColor,
      borderWidth: 1,
    });
    
    // Employee name
    page.drawText(`${emp.employee_name} (${emp.employee_no})`, {
      x: 50,
      y: y - 12,
      size: 10,
      font: fontBold,
      color: textColor,
    });
    
    // Department and leave type
    page.drawText(`Dept: ${emp.department} | Type: ${emp.leave_type}`, {
      x: 50,
      y: y - 24,
      size: 8,
      font: font,
      color: textColor,
    });
    
    // Leave details
    page.drawText(`Entitlement: ${emp.leave_entitlement}d | Taken: ${emp.days_taken}d | Remaining: ${emp.remaining_days}d`, {
      x: 50,
      y: y - 36,
      size: 8,
      font: font,
      color: textColor,
    });
    
    y -= 60;
  });
  
  // Footer with professional styling
  const footerY = 30;
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: 45,
    color: primaryColor,
  });
  
  page.drawRectangle({
    x: 0,
    y: 42,
    width: width,
    height: 3,
    color: accentColor,
  });
  
  page.drawText('KEREA HRMS - Leave Management System', {
    x: 50,
    y: footerY + 20,
    size: 9,
    font: font,
    color: white,
  });
  
  page.drawText('Confidential Document', {
    x: width - 140,
    y: footerY + 20,
    size: 9,
    font: font,
    color: lightAccent,
  });
  
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
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
    
    console.log('Leave report PDF export request:', { startDate, endDate, employeeId, departmentId, leaveTypeId, status });
    
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
    
    console.log('Where clause:', whereClause);
    
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
    console.log('Statistics:', stats);
    
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
    
    console.log('Payload created, generating PDF...');
    
    try {
      const pdfBuffer = await buildLeaveReportPdf(payload);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="kerea-leave-report-${new Date().toISOString().slice(0, 10)}.pdf"`);
      res.send(pdfBuffer);
    } catch (pdfError) {
      console.error('PDF generation error:', pdfError);
      return res.status(500).json({ message: 'Failed to generate PDF', error: pdfError.message });
    }
    
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
  } catch (error) {
    console.error('Leave report PDF export error:', error);
    next(error);
  }
};

module.exports = {
  getLeaveReportData,
  getLeaveReportFilters,
  exportLeaveReportPdf
};
