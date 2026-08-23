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
    const employeeLeaveSummary = payload.employeeLeaveSummary || [];
    const employeesOnLeave = payload.employeesOnLeave || [];

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const { width, height } = page.getSize();

    // Colors matching web report
    const primaryColor = rgb(0.13, 0.35, 0.18);
    const blueColor = rgb(0.22, 0.52, 0.96);
    const emeraldColor = rgb(0.05, 0.64, 0.31);
    const amberColor = rgb(0.92, 0.6, 0.0);
    const purpleColor = rgb(0.55, 0.15, 0.82);
    const textColor = rgb(0.15, 0.2, 0.3);
    const lightGray = rgb(0.94, 0.96, 0.98);
    const white = rgb(1, 1, 1);

    let y = height - 50;

    // Header
    page.drawText('LEAVE REPORT', {
      x: 50,
      y: y,
      size: 24,
      font: fontBold,
      color: primaryColor,
    });

    y -= 30;
    page.drawText('KEREA', {
      x: 50,
      y: y,
      size: 14,
      font: font,
      color: primaryColor,
    });

    y -= 30;
    page.drawText(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, {
      x: 50,
      y: y,
      size: 10,
      font: font,
      color: textColor,
    });

    y -= 40;

    // Summary Statistics - 4 cards with colors and icons
    page.drawText('Summary Statistics', {
      x: 50,
      y: y,
      size: 16,
      font: fontBold,
      color: primaryColor,
    });

    y -= 25;

    const cardWidth = 120;
    const cardHeight = 50;
    const cardGap = 15;

    const stats = [
      { label: 'Total Employees', value: statistics.totalEmployees || 0, color: blueColor },
      { label: 'Approved Leaves', value: statistics.approvedLeaves || 0, color: emeraldColor },
      { label: 'Pending Leaves', value: statistics.pendingLeaves || 0, color: amberColor },
      { label: 'Days Taken', value: statistics.totalLeaveDaysTaken || 0, color: purpleColor },
    ];

    stats.forEach((stat, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const cardX = 50 + col * (cardWidth + cardGap);
      const cardY = y - row * (cardHeight + cardGap);

      // Card background
      page.drawRectangle({
        x: cardX,
        y: cardY - cardHeight,
        width: cardWidth,
        height: cardHeight,
        color: white,
        borderColor: lightGray,
        borderWidth: 1,
      });

      // Draw icon based on index
      const iconX = cardX + 5;
      const iconY = cardY - 35;
      const iconSize = 15;

      if (index === 0) {
        // User icon (circle with body)
        page.drawEllipse({
          x: iconX + iconSize / 2,
          y: iconY + iconSize / 2 + 5,
          xScale: iconSize / 2.5,
          yScale: iconSize / 2.5,
          color: stat.color,
        });
        page.drawEllipse({
          x: iconX + iconSize / 2,
          y: iconY - 3,
          xScale: iconSize / 1.8,
          yScale: iconSize / 3,
          color: stat.color,
        });
      } else if (index === 1) {
        // Checkmark icon
        page.drawSvgPath('M2 12l5 5 9-9', {
          x: iconX,
          y: iconY + 5,
          scale: iconSize / 14,
          color: stat.color,
        });
      } else if (index === 2) {
        // Clock icon (circle with hands)
        page.drawEllipse({
          x: iconX + iconSize / 2,
          y: iconY + iconSize / 2,
          xScale: iconSize / 2,
          yScale: iconSize / 2,
          color: stat.color,
        });
        page.drawLine({
          start: { x: iconX + iconSize / 2, y: iconY + iconSize / 2 },
          end: { x: iconX + iconSize / 2, y: iconY + iconSize / 3 },
          thickness: 1.5,
          color: white,
        });
        page.drawLine({
          start: { x: iconX + iconSize / 2, y: iconY + iconSize / 2 },
          end: { x: iconX + iconSize / 1.5, y: iconY + iconSize / 2 },
          thickness: 1.5,
          color: white,
        });
      } else {
        // Calendar icon (rectangle with lines)
        page.drawRectangle({
          x: iconX,
          y: iconY,
          width: iconSize,
          height: iconSize,
          color: stat.color,
        });
        page.drawLine({
          start: { x: iconX, y: iconY + iconSize / 3 },
          end: { x: iconX + iconSize, y: iconY + iconSize / 3 },
          thickness: 1,
          color: white,
        });
      }

      // Label
      page.drawText(stat.label, {
        x: cardX + 30,
        y: cardY - 15,
        size: 8,
        font: font,
        color: textColor,
      });

      // Value
      page.drawText(String(stat.value), {
        x: cardX + 30,
        y: cardY - 35,
        size: 16,
        font: fontBold,
        color: textColor,
      });
    });

    y -= 2 * (cardHeight + cardGap) + 30;

    // Leave by Type - progress bars
    if (leaveByType && leaveByType.length > 0) {
      page.drawText('Leave by Type', {
        x: 50,
        y: y,
        size: 16,
        font: fontBold,
        color: primaryColor,
      });

      y -= 25;

      const maxDays = Math.max(...leaveByType.map(t => parseFloat(t.days_taken) || 0), 1);

      leaveByType.forEach((item) => {
        const leaveType = item.leave_type || 'N/A';
        const daysTaken = Math.round(parseFloat(item.days_taken) || 0);
        const barWidth = ((daysTaken / maxDays) * (width - 200));

        // Label
        page.drawText(leaveType, {
          x: 50,
          y: y,
          size: 10,
          font: fontBold,
          color: textColor,
        });

        y -= 12;

        // Background bar
        page.drawRectangle({
          x: 50,
          y: y - 8,
          width: width - 100,
          height: 8,
          color: lightGray,
        });

        // Progress bar
        page.drawRectangle({
          x: 50,
          y: y - 8,
          width: barWidth,
          height: 8,
          color: emeraldColor,
        });

        // Value
        page.drawText(`${daysTaken} days`, {
          x: width - 80,
          y: y + 5,
          size: 10,
          font: fontBold,
          color: textColor,
        });

        y -= 20;
      });

      y -= 20;
    }

    // Leave by Department - progress bars
    if (leaveByDepartment && leaveByDepartment.length > 0) {
      // Check if there's enough space on page 1, otherwise move to page 2
      const spaceNeeded = 25 + (leaveByDepartment.length * 32) + 20; // Title + each item + spacing
      if (y - spaceNeeded < 70) {
        // Not enough space, move to page 2
        page.drawText('KEREA HRMS - Confidential Document', {
          x: 50,
          y: 50,
          size: 10,
          font: font,
          color: primaryColor,
        });

        const page2 = pdfDoc.addPage([612, 792]);
        let y2 = height - 50;

        page2.drawText('LEAVE REPORT', {
          x: 50,
          y: y2,
          size: 24,
          font: fontBold,
          color: primaryColor,
        });

        page2.drawText('KEREA', {
          x: 50,
          y: y2 - 20,
          size: 14,
          font: font,
          color: primaryColor,
        });

        y2 -= 60;

        page2.drawText('Leave by Department', {
          x: 50,
          y: y2,
          size: 16,
          font: fontBold,
          color: primaryColor,
        });

        y2 -= 25;

        const maxDays = Math.max(...leaveByDepartment.map(d => parseFloat(d.days_taken) || 0), 1);

        leaveByDepartment.forEach((item) => {
          const department = item.department || 'N/A';
          const daysTaken = Math.round(parseFloat(item.days_taken) || 0);
          const barWidth = ((daysTaken / maxDays) * (width - 200));

          page2.drawText(department, {
            x: 50,
            y: y2,
            size: 10,
            font: fontBold,
            color: textColor,
          });

          y2 -= 12;

          page2.drawRectangle({
            x: 50,
            y: y2 - 8,
            width: width - 100,
            height: 8,
            color: lightGray,
          });

          page2.drawRectangle({
            x: 50,
            y: y2 - 8,
            width: barWidth,
            height: 8,
            color: blueColor,
          });

          page2.drawText(`${daysTaken} days`, {
            x: width - 80,
            y: y2 + 5,
            size: 10,
            font: fontBold,
            color: textColor,
          });

          y2 -= 20;
        });

        y2 -= 20;

        page2.drawText('KEREA HRMS - Confidential Document', {
          x: 50,
          y: 50,
          size: 10,
          font: font,
          color: primaryColor,
        });
      } else {
        // Draw on page 1
        page.drawText('Leave by Department', {
          x: 50,
          y: y,
          size: 16,
          font: fontBold,
          color: primaryColor,
        });

        y -= 25;

        const maxDays = Math.max(...leaveByDepartment.map(d => parseFloat(d.days_taken) || 0), 1);

        leaveByDepartment.forEach((item) => {
          const department = item.department || 'N/A';
          const daysTaken = Math.round(parseFloat(item.days_taken) || 0);
          const barWidth = ((daysTaken / maxDays) * (width - 200));

          page.drawText(department, {
            x: 50,
            y: y,
            size: 10,
            font: fontBold,
            color: textColor,
          });

          y -= 12;

          page.drawRectangle({
            x: 50,
            y: y - 8,
            width: width - 100,
            height: 8,
            color: lightGray,
          });

          page.drawRectangle({
            x: 50,
            y: y - 8,
            width: barWidth,
            height: 8,
            color: blueColor,
          });

          page.drawText(`${daysTaken} days`, {
            x: width - 80,
            y: y + 5,
            size: 10,
            font: fontBold,
            color: textColor,
          });

          y -= 20;
        });

        y -= 20;
      }
    }

    // Footer for page 1
    page.drawText('KEREA HRMS - Confidential Document', {
      x: 50,
      y: 50,
      size: 10,
      font: font,
      color: primaryColor,
    });

    // Add page 2 for Employee Leave Information
    const page2 = pdfDoc.addPage([612, 792]);
    let y2 = height - 50;

    // Header for page 2
    page2.drawText('Employee Leave Information (First 25)', {
      x: 50,
      y: y2,
      size: 24,
      font: fontBold,
      color: primaryColor,
    });

    y2 -= 30;
    page2.drawText('KEREA', {
      x: 50,
      y: y2,
      size: 14,
      font: font,
      color: primaryColor,
    });

    y2 -= 40;

    if (employeeLeaveInfo && employeeLeaveInfo.length > 0) {
      // Table header
      page2.drawText('Employee', { x: 50, y: y2, size: 9, font: fontBold, color: primaryColor });
      page2.drawText('Dept', { x: 130, y: y2, size: 9, font: fontBold, color: primaryColor });
      page2.drawText('Type', { x: 180, y: y2, size: 9, font: fontBold, color: primaryColor });
      page2.drawText('Entitlement', { x: 220, y: y2, size: 9, font: fontBold, color: primaryColor });
      page2.drawText('Taken', { x: 290, y: y2, size: 9, font: fontBold, color: primaryColor });
      page2.drawText('Remaining', { x: 350, y: y2, size: 9, font: fontBold, color: primaryColor });
      page2.drawText('Status', { x: 420, y: y2, size: 9, font: fontBold, color: primaryColor });

      y2 -= 15;

      employeeLeaveInfo.slice(0, 25).forEach((emp) => {
        const empName = (emp.employee_name || 'N/A').substring(0, 15);
        const department = (emp.department || 'N/A').substring(0, 8);
        const leaveType = emp.leave_type || 'N/A';
        const typeAbbrev = leaveType.substring(0, 2).toUpperCase();
        const entitlement = Math.round(parseFloat(emp.leave_entitlement) || 0);
        const daysTaken = Math.round(parseFloat(emp.days_taken) || 0);
        const remaining = Math.round(parseFloat(emp.remaining_days) || 0);
        const status = emp.current_status || 'N/A';

        // Color code status
        let statusColor = textColor;
        if (status && status.toLowerCase().includes('approved')) {
          statusColor = emeraldColor;
        } else if (status && status.toLowerCase().includes('pending')) {
          statusColor = amberColor;
        } else if (status && status.toLowerCase().includes('rejected')) {
          statusColor = rgb(0.8, 0.2, 0.2);
        }

        page2.drawText(empName, { x: 50, y: y2, size: 8, font: font, color: textColor });
        page2.drawText(department, { x: 130, y: y2, size: 8, font: font, color: textColor });
        page2.drawText(typeAbbrev, { x: 180, y: y2, size: 8, font: font, color: textColor });
        page2.drawText(String(entitlement), { x: 220, y: y2, size: 8, font: font, color: textColor });
        page2.drawText(String(daysTaken), { x: 290, y: y2, size: 8, font: font, color: textColor });
        page2.drawText(String(remaining), { x: 350, y: y2, size: 8, font: font, color: textColor });
        page2.drawText(status, { x: 420, y: y2, size: 8, font: font, color: statusColor });

        y2 -= 12;

        // Add new page if running out of space
        if (y2 < 50) {
          const newPage = pdfDoc.addPage([612, 792]);
          y2 = height - 50;
          newPage.drawText('Employee Leave Information (continued)', {
            x: 50,
            y: y2,
            size: 16,
            font: fontBold,
            color: primaryColor,
          });
          y2 -= 30;
        }
      });
    }

    // Footer for page 2
    page2.drawText('KEREA HRMS - Confidential Document', {
      x: 50,
      y: 30,
      size: 10,
      font: font,
      color: primaryColor,
    });

    // Add page 3 for Employee Leave Summary
    const page3 = pdfDoc.addPage([612, 792]);
    let y3 = height - 50;

    // Header for page 3
    page3.drawText('Employee Leave Summary', {
      x: 50,
      y: y3,
      size: 24,
      font: fontBold,
      color: primaryColor,
    });

    y3 -= 30;
    page3.drawText('KEREA', {
      x: 50,
      y: y3,
      size: 14,
      font: font,
      color: primaryColor,
    });

    y3 -= 40;

    // Pivot employee leave summary by employee
    const employeeMap = new Map();
    const leaveTypes = new Set();

    employeeLeaveSummary.forEach((emp) => {
      const empId = emp.employee_id;
      const empName = emp.employee_name || 'N/A';
      const empGender = emp.gender?.toLowerCase() || '';
      const department = emp.department || 'N/A';
      const leaveType = emp.leave_type || 'N/A';
      const leaveTypeLower = leaveType.toLowerCase();
      
      // Skip gender-inappropriate leave types
      if (empGender === 'male' && leaveTypeLower.includes('maternity')) return;
      if (empGender === 'female' && leaveTypeLower.includes('paternity')) return;

      const entitlement = parseFloat(emp.leave_entitlement) || 0;
      const daysTaken = parseFloat(emp.days_taken) || 0;

      leaveTypes.add(leaveType);

      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, {
          name: empName,
          gender: emp.gender,
          department: department,
          leaveTypes: {},
          totalEntitlement: 0,
          totalTaken: 0,
          totalRemaining: 0
        });
      }

      const empData = employeeMap.get(empId);
      const calculatedRemaining = Math.max(0, entitlement - daysTaken);
      empData.leaveTypes[leaveType] = {
        entitlement: entitlement,
        taken: daysTaken,
        remaining: calculatedRemaining,
        percentage: entitlement > 0 ? Math.round((daysTaken / entitlement) * 100) : 0
      };
      empData.totalEntitlement += entitlement;
      empData.totalTaken += daysTaken;
      empData.totalRemaining += calculatedRemaining;
    });

    const leaveTypesArray = Array.from(leaveTypes).sort();
    const employeesArray = Array.from(employeeMap.values());

    // Table header
    const colWidths = {
      name: 70,
      department: 60,
      leaveType: 55,
      remaining: 45,
      percentage: 45
    };

    let headerX = 50;
    page3.drawText('Employee', { x: headerX, y: y3, size: 8, font: fontBold, color: primaryColor });
    headerX += colWidths.name;
    page3.drawText('Department', { x: headerX, y: y3, size: 8, font: fontBold, color: primaryColor });
    headerX += colWidths.department;

    leaveTypesArray.forEach((lt) => {
      const label = lt.substring(0, 10);
      page3.drawText(label, { x: headerX, y: y3, size: 8, font: fontBold, color: primaryColor });
      headerX += colWidths.leaveType;
    });

    page3.drawText('Remaining', { x: headerX, y: y3, size: 8, font: fontBold, color: primaryColor });
    headerX += colWidths.remaining;
    page3.drawText('% Taken', { x: headerX, y: y3, size: 8, font: fontBold, color: primaryColor });

    y3 -= 15;

    // Table rows (first 30 employees)
    employeesArray.slice(0, 30).forEach((emp) => {
      let rowX = 50;
      const empName = emp.name.substring(0, 12);
      const dept = emp.department.substring(0, 10);

      page3.drawText(empName, { x: rowX, y: y3, size: 7, font: font, color: textColor });
      rowX += colWidths.name;
      page3.drawText(dept, { x: rowX, y: y3, size: 7, font: font, color: textColor });
      rowX += colWidths.department;

      leaveTypesArray.forEach((lt) => {
        const empGender = emp.gender?.toLowerCase() || '';
        const leaveTypeLower = lt.toLowerCase();
        
        // Show dash for gender-inappropriate leave types
        if (empGender === 'male' && leaveTypeLower.includes('maternity')) {
          page3.drawText('—', { x: rowX, y: y3, size: 7, font: font, color: textColor });
        } else if (empGender === 'female' && leaveTypeLower.includes('paternity')) {
          page3.drawText('—', { x: rowX, y: y3, size: 7, font: font, color: textColor });
        } else {
          const ltData = emp.leaveTypes[lt];
          if (ltData) {
            const taken = Math.round(ltData.taken);
            const entitlement = Math.round(ltData.entitlement);
            const label = `${taken}/${entitlement}`;
            page3.drawText(label, { x: rowX, y: y3, size: 7, font: font, color: textColor });
          } else {
            page3.drawText('-', { x: rowX, y: y3, size: 7, font: font, color: textColor });
          }
        }
        rowX += colWidths.leaveType;
      });

      page3.drawText(String(Math.round(emp.totalRemaining)), { x: rowX, y: y3, size: 7, font: font, color: textColor });
      rowX += colWidths.remaining;
      const totalPercentage = (emp.totalEntitlement > 0 && !isNaN(emp.totalEntitlement)) 
        ? Math.round((emp.totalTaken / emp.totalEntitlement) * 100) 
        : 0;
      page3.drawText(`${totalPercentage}%`, { x: rowX, y: y3, size: 7, font: font, color: textColor });

      y3 -= 12;
    });

    // Footer for page 3
    page3.drawText('KEREA HRMS - Confidential Document', {
      x: 50,
      y: 30,
      size: 10,
      font: font,
      color: primaryColor,
    });

    // Add page 4 for Employees Currently on Leave
    const page4 = pdfDoc.addPage([612, 792]);
    let y4 = height - 50;

    // Header for page 4
    page4.drawText('Employees Currently on Leave', {
      x: 50,
      y: y4,
      size: 24,
      font: fontBold,
      color: primaryColor,
    });

    y4 -= 30;
    page4.drawText('KEREA', {
      x: 50,
      y: y4,
      size: 14,
      font: font,
      color: primaryColor,
    });

    y4 -= 40;

    if (employeesOnLeave && employeesOnLeave.length > 0) {
      employeesOnLeave.forEach((emp) => {
        const empName = emp.employee_name || 'N/A';
        const leaveType = emp.leave_type || 'N/A';
        const startDate = emp.start_date ? new Date(emp.start_date).toISOString().split('T')[0] : 'N/A';
        const endDate = emp.end_date ? new Date(emp.end_date).toISOString().split('T')[0] : 'N/A';

        page4.drawText(`${empName} - ${leaveType} (${startDate} to ${endDate})`, {
          x: 50,
          y: y4,
          size: 9,
          font: font,
          color: textColor,
        });

        y4 -= 14;

        // Add new page if running out of space
        if (y4 < 50) {
          const newPage = pdfDoc.addPage([612, 792]);
          y4 = height - 50;
          newPage.drawText('Employees Currently on Leave (continued)', {
            x: 50,
            y: y4,
            size: 16,
            font: fontBold,
            color: primaryColor,
          });
          y4 -= 30;
        }
      });
    }

    // Footer for page 4
    page4.drawText('KEREA HRMS - Confidential Document', {
      x: 50,
      y: 30,
      size: 10,
      font: font,
      color: primaryColor,
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
        GROUP BY lt.id, lt.label
        ORDER BY days_taken DESC
      `,
      []
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
        GROUP BY d.id, d.name
        ORDER BY days_taken DESC
      `,
      []
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
    
    // Get employee leave information (individual leave requests, most recent first)
    const employeeLeaveResult = await query(
      `
        SELECT
          lr.id as request_id,
          u.id as employee_id,
          CONCAT(u.first_name, ' ', u.last_name) as employee_name,
          u.employee_no,
          COALESCE(d.name, 'Unassigned') as department,
          lt.label as leave_type,
          COALESCE(lt.default_days, 0) as leave_entitlement,
          COALESCE(lb.balance_days, 0) as remaining_days,
          lr.days_requested as days_taken,
          lr.status as current_status,
          lr.start_date,
          lr.end_date
        FROM leave_requests lr
        INNER JOIN users u ON u.id = lr.user_id
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
        LEFT JOIN leave_balances lb ON lb.user_id = u.id AND lb.leave_type_id = lt.id
        WHERE u.is_deleted = FALSE
          AND lr.status = 'approved'
        ORDER BY lr.start_date DESC, lr.id DESC
        LIMIT 25
      `,
      []
    );

    // Get all employee leave data for Employee Leave Summary (includes ongoing leave)
    const employeeLeaveSummaryResult = await query(
      `
        SELECT
          u.id as employee_id,
          CONCAT(u.first_name, ' ', u.last_name) as employee_name,
          u.gender,
          COALESCE(d.name, 'Unassigned') as department,
          lt.label as leave_type,
          COALESCE(lt.default_days, 0) as leave_entitlement,
          COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END), 0) as days_taken
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN leave_balances lb ON lb.user_id = u.id
        LEFT JOIN leave_types lt ON lt.id = lb.leave_type_id
        LEFT JOIN leave_requests lr ON lr.user_id = u.id AND lr.leave_type_id = lt.id AND lr.status = 'approved'
        WHERE u.is_deleted = FALSE
        GROUP BY u.id, u.first_name, u.last_name, u.gender, d.name, lt.label, lt.default_days
        ORDER BY u.last_name, u.first_name
      `,
      []
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
      employeeLeaveSummary: employeeLeaveSummaryResult.rows,
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
            lr.id as request_id,
            u.id as employee_id,
            CONCAT(u.first_name, ' ', u.last_name) as employee_name,
            u.employee_no,
            COALESCE(d.name, 'Unassigned') as department,
            lt.label as leave_type,
            COALESCE(lt.default_days, 0) as leave_entitlement,
            COALESCE(lb.balance_days, 0) as remaining_days,
            lr.days_requested as days_taken,
            lr.status as current_status,
            lr.start_date,
            lr.end_date
          FROM leave_requests lr
          INNER JOIN users u ON u.id = lr.user_id
          LEFT JOIN departments d ON d.id = u.department_id
          LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
          LEFT JOIN leave_balances lb ON lb.user_id = u.id AND lb.leave_type_id = lt.id
          WHERE u.is_deleted = FALSE
            AND lr.status = 'approved'
          ORDER BY lr.start_date DESC, lr.id DESC
          LIMIT 25
        `,
        []
      );
      console.log('Employee leave info fetched successfully');
    } catch (err) {
      console.error('Employee leave info query error:', err);
      employeeLeaveResult = { rows: [] };
    }

    // Get employee leave summary for PDF
    let employeeLeaveSummaryResult;
    try {
      employeeLeaveSummaryResult = await query(
        `
          SELECT
            u.id as employee_id,
            CONCAT(u.first_name, ' ', u.last_name) as employee_name,
            u.gender,
            COALESCE(d.name, 'Unassigned') as department,
            lt.label as leave_type,
            COALESCE(lt.default_days, 0) as leave_entitlement,
            COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END), 0) as days_taken
          FROM users u
          LEFT JOIN departments d ON d.id = u.department_id
          LEFT JOIN leave_balances lb ON lb.user_id = u.id
          LEFT JOIN leave_types lt ON lt.id = lb.leave_type_id
          LEFT JOIN leave_requests lr ON lr.user_id = u.id AND lr.leave_type_id = lt.id AND lr.status = 'approved'
          WHERE u.is_deleted = FALSE
          GROUP BY u.id, u.first_name, u.last_name, u.gender, d.name, lt.label, lt.default_days
          ORDER BY u.last_name, u.first_name
        `,
        []
      );
      console.log('Employee leave summary fetched successfully');
    } catch (err) {
      console.error('Employee leave summary query error:', err);
      employeeLeaveSummaryResult = { rows: [] };
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
      employeeLeaveSummary: employeeLeaveSummaryResult.rows,
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
