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
  
  // Professional color scheme
  const primaryColor = rgb(0.13, 0.35, 0.18);
  const accentColor = rgb(0.45, 0.75, 0.55);
  const lightAccent = rgb(0.85, 0.95, 0.9);
  const textColor = rgb(0.15, 0.2, 0.3);
  const borderColor = rgb(0.75, 0.75, 0.8);
  const white = rgb(1, 1, 1);
  
  // Header section - separate from body
  page.drawRectangle({
    x: 0,
    y: height - 60,
    width: width,
    height: 60,
    color: primaryColor,
  });
  
  page.drawText('LEAVE REPORT', {
    x: 50,
    y: height - 25,
    size: 22,
    font: fontBold,
    color: white,
  });
  
  page.drawText('KEREA', {
    x: 50,
    y: height - 45,
    size: 14,
    font: font,
    color: lightAccent,
  });
  
  page.drawText(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, {
    x: width - 200,
    y: height - 35,
    size: 10,
    font: font,
    color: lightAccent,
  });
  
  let y = height - 80;
  
  // Executive Summary Section
  page.drawRectangle({
    x: 40,
    y: y - 10,
    width: width - 80,
    height: 120,
    color: white,
    borderColor: primaryColor,
    borderWidth: 1.5,
  });
  
  page.drawText('EXECUTIVE SUMMARY', {
    x: 50,
    y: y - 5,
    size: 11,
    font: fontBold,
    color: primaryColor,
  });
  
  const summaryData = [
    { label: 'Total Employees', value: statistics.totalEmployees || 0 },
    { label: 'Total Leave Applications', value: statistics.totalLeaveApplications || 0 },
    { label: 'Approved Leaves', value: statistics.approvedLeaves || 0 },
    { label: 'Pending Leaves', value: statistics.pendingLeaves || 0 },
    { label: 'Rejected Leaves', value: statistics.rejectedLeaves || 0 },
    { label: 'Employees Currently on Leave', value: statistics.employeesOnLeave || 0 },
    { label: 'Total Leave Days Taken', value: statistics.totalLeaveDaysTaken || 0 },
  ];
  
  summaryData.forEach((item, index) => {
    const rowY = y - 28 - (index * 13);
    page.drawText(item.label, {
      x: 50,
      y: rowY,
      size: 9,
      font: font,
      color: textColor,
    });
    
    page.drawText(String(item.value), {
      x: 250,
      y: rowY,
      size: 9,
      font: fontBold,
      color: primaryColor,
    });
  });
  
  y -= 140;
  
  // Leave Type Distribution Section
  page.drawRectangle({
    x: 40,
    y: y - 10,
    width: width - 80,
    height: 120,
    color: white,
    borderColor: primaryColor,
    borderWidth: 1.5,
  });
  
  page.drawText('LEAVE TYPE DISTRIBUTION', {
    x: 50,
    y: y - 5,
    size: 11,
    font: fontBold,
    color: primaryColor,
  });
  
  const maxTypeDays = Math.max(...leaveByType.map(d => d.days_taken), 1);
  leaveByType.slice(0, 5).forEach((item, index) => {
    const barWidth = ((item.days_taken / maxTypeDays) * 200);
    const barY = y - 30 - (index * 18);
    
    page.drawText(`${item.leave_type}`, {
      x: 50,
      y: barY + 5,
      size: 9,
      font: fontBold,
      color: textColor,
    });
    
    page.drawText(`${item.days_taken} days`, {
      x: 50,
      y: barY - 4,
      size: 8,
      font: font,
      color: textColor,
    });
    
    page.drawRectangle({
      x: 200,
      y: barY - 2,
      width: 200,
      height: 10,
      color: lightAccent,
    });
    
    page.drawRectangle({
      x: 200,
      y: barY - 2,
      width: barWidth,
      height: 10,
      color: accentColor,
    });
  });
  
  y -= 140;
  
  // Department Distribution Section
  page.drawRectangle({
    x: 40,
    y: y - 10,
    width: width - 80,
    height: 120,
    color: white,
    borderColor: primaryColor,
    borderWidth: 1.5,
  });
  
  page.drawText('DEPARTMENT DISTRIBUTION', {
    x: 50,
    y: y - 5,
    size: 11,
    font: fontBold,
    color: primaryColor,
  });
  
  const maxDeptDays = Math.max(...leaveByDepartment.map(d => d.days_taken), 1);
  leaveByDepartment.slice(0, 5).forEach((item, index) => {
    const barWidth = ((item.days_taken / maxDeptDays) * 200);
    const barY = y - 30 - (index * 18);
    
    page.drawText(`${item.department}`, {
      x: 50,
      y: barY + 5,
      size: 9,
      font: fontBold,
      color: textColor,
    });
    
    page.drawText(`${item.days_taken} days`, {
      x: 50,
      y: barY - 4,
      size: 8,
      font: font,
      color: textColor,
    });
    
    page.drawRectangle({
      x: 200,
      y: barY - 2,
      width: 200,
      height: 10,
      color: lightAccent,
    });
    
    page.drawRectangle({
      x: 200,
      y: barY - 2,
      width: barWidth,
      height: 10,
      color: primaryColor,
    });
  });
  
  y -= 140;
  
  // Employees Currently on Leave Section
  if (employeesOnLeave.length > 0) {
    const sectionHeight = 70 + (employeesOnLeave.length * 20);
    page.drawRectangle({
      x: 40,
      y: y - 10,
      width: width - 80,
      height: sectionHeight,
      color: white,
      borderColor: primaryColor,
      borderWidth: 1.5,
    });
    
    page.drawText('EMPLOYEES CURRENTLY ON LEAVE', {
      x: 50,
      y: y - 5,
      size: 11,
      font: fontBold,
      color: primaryColor,
    });
    
    employeesOnLeave.slice(0, 3).forEach((emp, index) => {
      const empY = y - 30 - (index * 20);
      
      page.drawText(`${emp.employee_name} (${emp.employee_no})`, {
        x: 50,
        y: empY,
        size: 9,
        font: fontBold,
        color: textColor,
      });
      
      page.drawText(`${emp.leave_type}: ${emp.start_date} - ${emp.end_date} (${emp.days_requested}d)`, {
        x: 70,
        y: empY - 9,
        size: 8,
        font: font,
        color: textColor,
      });
    });
    
    y -= sectionHeight + 15;
  }
  
  // Employee Leave Information Section
  page.drawText('EMPLOYEE LEAVE INFORMATION', {
    x: 50,
    y: y - 5,
    size: 11,
    font: fontBold,
    color: primaryColor,
  });
  
  y -= 15;
  
  // Table header
  page.drawRectangle({
    x: 40,
    y: y - 18,
    width: width - 80,
    height: 18,
    color: primaryColor,
  });
  
  page.drawText('Employee', {
    x: 45,
    y: y - 6,
    size: 8,
    font: fontBold,
    color: white,
  });
  
  page.drawText('Department', {
    x: 200,
    y: y - 6,
    size: 8,
    font: fontBold,
    color: white,
  });
  
  page.drawText('Leave Type', {
    x: 320,
    y: y - 6,
    size: 8,
    font: fontBold,
    color: white,
  });
  
  page.drawText('Entitlement', {
    x: 420,
    y: y - 6,
    size: 8,
    font: fontBold,
    color: white,
  });
  
  page.drawText('Taken', {
    x: 490,
    y: y - 6,
    size: 8,
    font: fontBold,
    color: white,
  });
  
  page.drawText('Remaining', {
    x: 530,
    y: y - 6,
    size: 8,
    font: fontBold,
    color: white,
  });
  
  y -= 23;
  
  let currentPage = page;
  let currentPageY = y;
  
  employeeLeaveInfo.forEach((emp, index) => {
    if (currentPageY < 50) {
      // Add new page
      currentPage = pdfDoc.addPage([612, 792]);
      currentPageY = currentPage.getHeight() - 70;
      
      // Header on new page
      currentPage.drawRectangle({
        x: 0,
        y: currentPage.getHeight() - 60,
        width: width,
        height: 60,
        color: primaryColor,
      });
      
      currentPage.drawText('LEAVE REPORT (CONTINUED)', {
        x: 50,
        y: currentPage.getHeight() - 25,
        size: 18,
        font: fontBold,
        color: white,
      });
      
      currentPage.drawText('KEREA', {
        x: 50,
        y: currentPage.getHeight() - 45,
        size: 12,
        font: font,
        color: lightAccent,
      });
      
      currentPageY -= 80;
      
      // Table header on new page
      currentPage.drawRectangle({
        x: 40,
        y: currentPageY - 18,
        width: width - 80,
        height: 18,
        color: primaryColor,
      });
      
      currentPage.drawText('Employee', {
        x: 45,
        y: currentPageY - 6,
        size: 8,
        font: fontBold,
        color: white,
      });
      
      currentPage.drawText('Department', {
        x: 200,
        y: currentPageY - 6,
        size: 8,
        font: fontBold,
        color: white,
      });
      
      currentPage.drawText('Leave Type', {
        x: 320,
        y: currentPageY - 6,
        size: 8,
        font: fontBold,
        color: white,
      });
      
      currentPage.drawText('Entitlement', {
        x: 420,
        y: currentPageY - 6,
        size: 8,
        font: fontBold,
        color: white,
      });
      
      currentPage.drawText('Taken', {
        x: 490,
        y: currentPageY - 6,
        size: 8,
        font: fontBold,
        color: white,
      });
      
      currentPage.drawText('Remaining', {
        x: 530,
        y: currentPageY - 6,
        size: 8,
        font: fontBold,
        color: white,
      });
      
      currentPageY -= 23;
    }
    
    // Row background
    if (index % 2 === 0) {
      currentPage.drawRectangle({
        x: 40,
        y: currentPageY - 16,
        width: width - 80,
        height: 16,
        color: lightAccent,
      });
    }
    
    // Employee name
    currentPage.drawText(`${emp.employee_name}`, {
      x: 45,
      y: currentPageY - 5,
      size: 8,
      font: fontBold,
      color: textColor,
    });
    
    currentPage.drawText(`(${emp.employee_no})`, {
      x: 45,
      y: currentPageY - 13,
      size: 7,
      font: font,
      color: textColor,
    });
    
    // Department
    currentPage.drawText(emp.department || 'N/A', {
      x: 200,
      y: currentPageY - 8,
      size: 8,
      font: font,
      color: textColor,
    });
    
    // Leave type
    currentPage.drawText(emp.leave_type || 'N/A', {
      x: 320,
      y: currentPageY - 8,
      size: 8,
      font: font,
      color: textColor,
    });
    
    // Entitlement
    currentPage.drawText(String(emp.leave_entitlement || 0), {
      x: 420,
      y: currentPageY - 8,
      size: 8,
      font: font,
      color: textColor,
    });
    
    // Taken
    currentPage.drawText(String(emp.days_taken || 0), {
      x: 490,
      y: currentPageY - 8,
      size: 8,
      font: font,
      color: textColor,
    });
    
    // Remaining
    currentPage.drawText(String(emp.remaining_days || 0), {
      x: 530,
      y: currentPageY - 8,
      size: 8,
      font: font,
      color: textColor,
    });
    
    currentPageY -= 20;
  });
  
  // Footer on last page
  const lastPage = currentPage;
  lastPage.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: 30,
    color: primaryColor,
  });
  
  lastPage.drawText('KEREA HRMS - Leave Management System', {
    x: 50,
    y: 12,
    size: 9,
    font: font,
    color: white,
  });
  
  lastPage.drawText('Confidential Document', {
    x: width - 140,
    y: 12,
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
