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
  
  // Professional color scheme matching web page
  const primaryColor = rgb(0.13, 0.35, 0.18);
  const accentColor = rgb(0.45, 0.75, 0.55);
  const lightAccent = rgb(0.85, 0.95, 0.9);
  const textColor = rgb(0.15, 0.2, 0.3);
  const borderColor = rgb(0.75, 0.75, 0.8);
  const white = rgb(1, 1, 1);
  const blueColor = rgb(0.22, 0.52, 0.96);
  const emeraldColor = rgb(0.05, 0.64, 0.31);
  const amberColor = rgb(0.92, 0.6, 0.0);
  const purpleColor = rgb(0.55, 0.15, 0.82);
  const bgColor = rgb(0.97, 0.98, 0.99);
  
  // Header section
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
  
  let y = height - 90;
  
  // Summary Statistics Section - matching web page cards
  page.drawText('Summary Statistics', {
    x: 50,
    y: y,
    size: 14,
    font: fontBold,
    color: primaryColor,
  });
  
  page.drawText('Overview of leave data across the organization.', {
    x: 50,
    y: y - 12,
    size: 10,
    font: font,
    color: textColor,
  });
  
  y -= 25;
  
  // Draw 4 summary cards in a grid
  const cardWidth = (width - 100) / 2;
  const cardHeight = 60;
  const cardGap = 15;
  
  const summaryCards = [
    { label: 'Total Employees', value: statistics.totalEmployees || 0, color: blueColor },
    { label: 'Approved Leaves', value: statistics.approvedLeaves || 0, color: emeraldColor },
    { label: 'Pending Leaves', value: statistics.pendingLeaves || 0, color: amberColor },
    { label: 'Days Taken', value: statistics.totalLeaveDaysTaken || 0, color: purpleColor },
  ];
  
  summaryCards.forEach((card, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const cardX = 50 + col * (cardWidth + cardGap);
    const cardY = y - row * (cardHeight + cardGap);
    
    // Card background
    page.drawRectangle({
      x: cardX,
      y: cardY - cardHeight,
      width: cardWidth,
      height: cardHeight,
      color: white,
      borderColor: borderColor,
      borderWidth: 1,
    });
    
    // Icon circle
    const iconColor = card.color;
    page.drawCircle({
      x: cardX + 25,
      y: cardY - 30,
      size: 18,
      color: iconColor,
      opacity: 0.1,
    });
    
    // Icon (simple representation)
    page.drawCircle({
      x: cardX + 25,
      y: cardY - 30,
      size: 8,
      color: iconColor,
    });
    
    // Label
    page.drawText(card.label, {
      x: cardX + 55,
      y: cardY - 20,
      size: 9,
      font: font,
      color: textColor,
    });
    
    // Value
    page.drawText(String(card.value), {
      x: cardX + 55,
      y: cardY - 40,
      size: 18,
      font: fontBold,
      color: textColor,
    });
  });
  
  y -= 2 * (cardHeight + cardGap) + 20;
  
  // Leave by Type Section
  page.drawText('Leave by Type', {
    x: 50,
    y: y,
    size: 14,
    font: fontBold,
    color: primaryColor,
  });
  
  page.drawText('Leave days taken by leave type.', {
    x: 50,
    y: y - 12,
    size: 10,
    font: font,
    color: textColor,
  });
  
  y -= 25;
  
  // Leave type bars
  const maxTypeDays = Math.max(...leaveByType.map(d => d.days_taken), 1);
  leaveByType.forEach((item, index) => {
    const barWidth = ((item.days_taken / maxTypeDays) * (width - 200));
    const barY = y - 20 - (index * 25);
    
    // Label
    page.drawText(`${item.leave_type}`, {
      x: 50,
      y: barY + 8,
      size: 10,
      font: fontBold,
      color: textColor,
    });
    
    // Background bar
    page.drawRectangle({
      x: 50,
      y: barY - 5,
      width: width - 100,
      height: 8,
      color: rgb(0.94, 0.96, 0.98),
    });
    
    // Progress bar
    page.drawRectangle({
      x: 50,
      y: barY - 5,
      width: barWidth,
      height: 8,
      color: emeraldColor,
    });
    
    // Value
    page.drawText(`${item.days_taken.toFixed(2)} days`, {
      x: width - 80,
      y: barY + 3,
      size: 10,
      font: fontBold,
      color: textColor,
    });
  });
  
  y -= leaveByType.length * 25 + 30;
  
  // Leave by Department Section
  page.drawText('Leave by Department', {
    x: 50,
    y: y,
    size: 14,
    font: fontBold,
    color: primaryColor,
  });
  
  page.drawText('Leave utilization across departments.', {
    x: 50,
    y: y - 12,
    size: 10,
    font: font,
    color: textColor,
  });
  
  y -= 25;
  
  // Department bars
  const maxDeptDays = Math.max(...leaveByDepartment.map(d => d.days_taken), 1);
  leaveByDepartment.forEach((item, index) => {
    const barWidth = ((item.days_taken / maxDeptDays) * (width - 200));
    const barY = y - 20 - (index * 25);
    
    // Label
    page.drawText(`${item.department}`, {
      x: 50,
      y: barY + 8,
      size: 10,
      font: fontBold,
      color: textColor,
    });
    
    // Background bar
    page.drawRectangle({
      x: 50,
      y: barY - 5,
      width: width - 100,
      height: 8,
      color: rgb(0.94, 0.96, 0.98),
    });
    
    // Progress bar
    page.drawRectangle({
      x: 50,
      y: barY - 5,
      width: barWidth,
      height: 8,
      color: blueColor,
    });
    
    // Value
    page.drawText(`${item.days_taken.toFixed(2)} days`, {
      x: width - 80,
      y: barY + 3,
      size: 10,
      font: fontBold,
      color: textColor,
    });
  });
  
  y -= leaveByDepartment.length * 25 + 30;
  
  // Employee Leave Information Section
  page.drawText('Employee Leave Information', {
    x: 50,
    y: y,
    size: 14,
    font: fontBold,
    color: primaryColor,
  });
  
  page.drawText('Detailed leave information for each employee.', {
    x: 50,
    y: y - 12,
    size: 10,
    font: font,
    color: textColor,
  });
  
  y -= 25;
  
  // Table header
  page.drawRectangle({
    x: 40,
    y: y - 20,
    width: width - 80,
    height: 20,
    color: primaryColor,
  });
  
  const headers = ['Employee', 'Department', 'Leave Type', 'Entitlement', 'Days Taken', 'Remaining', 'Pending', 'Status'];
  const headerX = [45, 130, 220, 310, 380, 450, 510, 560];
  headers.forEach((header, index) => {
    page.drawText(header, {
      x: headerX[index],
      y: y - 8,
      size: 8,
      font: fontBold,
      color: white,
    });
  });
  
  y -= 25;
  
  let currentPage = page;
  let currentPageY = y;
  
  employeeLeaveInfo.forEach((emp, index) => {
    if (currentPageY < 60) {
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
        y: currentPageY - 20,
        width: width - 80,
        height: 20,
        color: primaryColor,
      });
      
      headers.forEach((header, index) => {
        currentPage.drawText(header, {
          x: headerX[index],
          y: currentPageY - 8,
          size: 8,
          font: fontBold,
          color: white,
        });
      });
      
      currentPageY -= 25;
    }
    
    // Row background
    if (index % 2 === 0) {
      currentPage.drawRectangle({
        x: 40,
        y: currentPageY - 18,
        width: width - 80,
        height: 18,
        color: bgColor,
      });
    }
    
    // Employee name and number
    currentPage.drawText(`${emp.employee_name}`, {
      x: 45,
      y: currentPageY - 5,
      size: 8,
      font: fontBold,
      color: textColor,
    });
    
    currentPage.drawText(`${emp.employee_no}`, {
      x: 45,
      y: currentPageY - 13,
      size: 7,
      font: font,
      color: textColor,
    });
    
    // Department
    currentPage.drawText(emp.department || 'Unassigned', {
      x: 130,
      y: currentPageY - 8,
      size: 8,
      font: font,
      color: textColor,
    });
    
    // Leave type
    currentPage.drawText(emp.leave_type || 'N/A', {
      x: 220,
      y: currentPageY - 8,
      size: 8,
      font: font,
      color: textColor,
    });
    
    // Entitlement
    currentPage.drawText(String(emp.leave_entitlement || 0), {
      x: 310,
      y: currentPageY - 8,
      size: 8,
      font: font,
      color: textColor,
    });
    
    // Days taken
    currentPage.drawText(String(emp.days_taken || 0), {
      x: 380,
      y: currentPageY - 8,
      size: 8,
      font: font,
      color: textColor,
    });
    
    // Remaining
    currentPage.drawText(String(emp.remaining_days || 0), {
      x: 450,
      y: currentPageY - 8,
      size: 8,
      font: font,
      color: textColor,
    });
    
    // Pending
    currentPage.drawText(String(emp.pending_days || 0), {
      x: 510,
      y: currentPageY - 8,
      size: 8,
      font: font,
      color: textColor,
    });
    
    // Status
    const statusColor = emp.current_status === 'approved' ? emeraldColor : emp.current_status && emp.current_status.includes('pending') ? amberColor : rgb(0.94, 0.23, 0.23);
    currentPage.drawText(emp.current_status || 'N/A', {
      x: 560,
      y: currentPageY - 8,
      size: 8,
      font: fontBold,
      color: statusColor,
    });
    
    currentPageY -= 20;
  });
  
  // Employees Currently on Leave Section
  if (employeesOnLeave.length > 0) {
    if (currentPageY < 100) {
      currentPage = pdfDoc.addPage([612, 792]);
      currentPageY = currentPage.getHeight() - 70;
      
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
    }
    
    currentPage.drawText('Employees Currently on Leave', {
      x: 50,
      y: currentPageY,
      size: 14,
      font: fontBold,
      color: primaryColor,
    });
    
    currentPage.drawText('Employees who are currently on leave.', {
      x: 50,
      y: currentPageY - 12,
      size: 10,
      font: font,
      color: textColor,
    });
    
    currentPageY -= 25;
    
    employeesOnLeave.forEach((emp, index) => {
      const empY = currentPageY - 20 - (index * 40);
      
      // Card
      currentPage.drawRectangle({
        x: 40,
        y: empY - 35,
        width: width - 80,
        height: 35,
        color: white,
        borderColor: borderColor,
        borderWidth: 1,
      });
      
      // Employee name
      currentPage.drawText(emp.employee_name, {
        x: 50,
        y: empY - 10,
        size: 10,
        font: fontBold,
        color: textColor,
      });
      
      // Employee number
      currentPage.drawText(emp.employee_no, {
        x: 50,
        y: empY - 22,
        size: 8,
        font: font,
        color: textColor,
      });
      
      // Leave type
      currentPage.drawText(emp.leave_type, {
        x: 200,
        y: empY - 10,
        size: 10,
        font: fontBold,
        color: textColor,
      });
      
      // Date range
      const startDate = new Date(emp.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const endDate = new Date(emp.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      currentPage.drawText(`${startDate} to ${endDate}`, {
        x: 200,
        y: empY - 22,
        size: 8,
        font: font,
        color: textColor,
      });
      
      currentPageY -= 40;
    });
  }
  
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
