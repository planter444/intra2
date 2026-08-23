const { query } = require('../config/db');
const { logAction } = require('../services/auditService');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const escapePdfText = (value) => String(value ?? '').replace(/[\\()]/g, '\\$&');

const buildLeaveReportPdf = async (payload) => {
  try {
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

    // Header
    page.drawText('LEAVE REPORT', {
      x: 50,
      y: y,
      size: 24,
      font: fontBold,
    });

    y -= 30;
    page.drawText('KEREA', {
      x: 50,
      y: y,
      size: 14,
      font: font,
    });

    y -= 30;
    page.drawText(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, {
      x: 50,
      y: y,
      size: 10,
      font: font,
    });

    y -= 40;

    // Summary Statistics
    page.drawText('Summary Statistics', {
      x: 50,
      y: y,
      size: 16,
      font: fontBold,
    });

    y -= 25;
    page.drawText(`Total Employees: ${statistics.totalEmployees || 0}`, {
      x: 50,
      y: y,
      size: 12,
      font: font,
    });

    y -= 20;
    page.drawText(`Approved Leaves: ${statistics.approvedLeaves || 0}`, {
      x: 50,
      y: y,
      size: 12,
      font: font,
    });

    y -= 20;
    page.drawText(`Pending Leaves: ${statistics.pendingLeaves || 0}`, {
      x: 50,
      y: y,
      size: 12,
      font: font,
    });

    y -= 20;
    page.drawText(`Total Leave Days Taken: ${statistics.totalLeaveDaysTaken || 0}`, {
      x: 50,
      y: y,
      size: 12,
      font: font,
    });

    y -= 30;

    // Leave by Type
    if (leaveByType && leaveByType.length > 0) {
      page.drawText('Leave by Type', {
        x: 50,
        y: y,
        size: 16,
        font: fontBold,
      });

      y -= 25;
      leaveByType.forEach((item) => {
        const leaveType = item.leave_type || 'N/A';
        const daysTaken = item.days_taken || 0;
        page.drawText(`${leaveType}: ${daysTaken.toFixed(2)} days`, {
          x: 50,
          y: y,
          size: 12,
          font: font,
        });
        y -= 18;
      });
      y -= 10;
    }

    y -= 10;

    // Leave by Department
    if (leaveByDepartment && leaveByDepartment.length > 0) {
      page.drawText('Leave by Department', {
        x: 50,
        y: y,
        size: 16,
        font: fontBold,
      });

      y -= 25;
      leaveByDepartment.forEach((item) => {
        const department = item.department || 'N/A';
        const daysTaken = item.days_taken || 0;
        page.drawText(`${department}: ${daysTaken.toFixed(2)} days`, {
          x: 50,
          y: y,
          size: 12,
          font: font,
        });
        y -= 18;
      });
      y -= 10;
    }

    y -= 10;

    // Employee Leave Information (first 20)
    if (employeeLeaveInfo && employeeLeaveInfo.length > 0) {
      page.drawText('Employee Leave Information (First 20)', {
        x: 50,
        y: y,
        size: 16,
        font: fontBold,
      });

      y -= 25;
      employeeLeaveInfo.slice(0, 20).forEach((emp) => {
        const empName = emp.employee_name || 'N/A';
        const leaveType = emp.leave_type || 'N/A';
        const daysTaken = emp.days_taken || 0;
        const status = emp.current_status || 'N/A';

        page.drawText(`${empName} - ${leaveType} - ${daysTaken} days - ${status}`, {
          x: 50,
          y: y,
          size: 10,
          font: font,
        });
        y -= 14;
      });
    }

    y -= 10;

    // Employees Currently on Leave
    if (employeesOnLeave && employeesOnLeave.length > 0) {
      page.drawText('Employees Currently on Leave', {
        x: 50,
        y: y,
        size: 16,
        font: fontBold,
      });

      y -= 25;
      employeesOnLeave.slice(0, 10).forEach((emp) => {
        const empName = emp.employee_name || 'N/A';
        const leaveType = emp.leave_type || 'N/A';
        const startDate = emp.start_date || 'N/A';
        const endDate = emp.end_date || 'N/A';

        page.drawText(`${empName} - ${leaveType} (${startDate} to ${endDate})`, {
          x: 50,
          y: y,
          size: 9,
          font: font,
        });

        y -= 14;
      });
    }

    // Footer
    page.drawText('KEREA HRMS - Confidential Document', {
      x: 50,
      y: 30,
      size: 10,
      font: font,
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('PDF build error:', error);
    throw new Error(`Failed to build PDF: ${error.message}`);
  }
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
          COALESCE(SUM(CASE WHEN lr.status LIKE 'pending%' THEN lr.days_requested ELSE 0 END), 0) as pending_days,
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
    
    console.log('Starting PDF export with filters:', { startDate, endDate, employeeId, departmentId, leaveTypeId, status });
    
    // Build WHERE clause
    const conditions = [];
    const params = [];
    
    if (startDate) {
      params.push(startDate);
      conditions.push(`lr.start_date >= $${params.length}`);
    }
    
    if (endDate) {
      params.push(endDate);
      conditions.push(`lr.end_date <= $${params.length}`);
    }
    
    if (employeeId) {
      params.push(employeeId);
      conditions.push(`lr.user_id = $${params.length}`);
    }
    
    if (departmentId) {
      params.push(departmentId);
      conditions.push(`u.department_id = $${params.length}`);
    }
    
    if (leaveTypeId) {
      params.push(leaveTypeId);
      conditions.push(`lr.leave_type_id = $${params.length}`);
    }
    
    if (status) {
      params.push(status);
      conditions.push(`lr.status = $${params.length}`);
    }
    
    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
    
    console.log('WHERE clause built, executing statistics query...');
    
    // Get summary statistics
    let statsResult;
    try {
      statsResult = await query(
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
      console.log('Statistics fetched successfully');
    } catch (err) {
      console.error('Statistics query error:', err);
      throw new Error(`Statistics query failed: ${err.message}`);
    }
    
    const stats = statsResult.rows[0];
    
    // Get leave days by type
    let leaveByTypeResult;
    try {
      leaveByTypeResult = await query(
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
      console.log('Leave by type fetched successfully');
    } catch (err) {
      console.error('Leave by type query error:', err);
      leaveByTypeResult = { rows: [] };
    }
    
    // Get leave utilization by department
    let leaveByDeptResult;
    try {
      leaveByDeptResult = await query(
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
      console.log('Leave by department fetched successfully');
    } catch (err) {
      console.error('Leave by department query error:', err);
      leaveByDeptResult = { rows: [] };
    }
    
    // Get employee leave information
    let employeeLeaveResult;
    try {
      employeeLeaveResult = await query(
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
            COALESCE(SUM(CASE WHEN lr.status LIKE 'pending%' THEN lr.days_requested ELSE 0 END), 0) as pending_days,
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
      console.log('Employee leave info fetched successfully');
    } catch (err) {
      console.error('Employee leave info query error:', err);
      employeeLeaveResult = { rows: [] };
    }
    
    // Get employees currently on leave
    let onLeaveResult;
    try {
      onLeaveResult = await query(
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
      console.log('Employees on leave fetched successfully');
    } catch (err) {
      console.error('Employees on leave query error:', err);
      onLeaveResult = { rows: [] };
    }
    
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
      console.error('Error stack:', pdfError.stack);
      return res.status(500).json({ message: 'Failed to generate PDF', error: pdfError.message, stack: pdfError.stack });
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
    console.error('Error stack:', error.stack);
    next(error);
  }
};

module.exports = {
  getLeaveReportData,
  getLeaveReportFilters,
  exportLeaveReportPdf
};
