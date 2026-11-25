const { query } = require('../config/db');
const { logAction } = require('../services/auditService');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const escapePdfText = (value) => String(value ?? '').replace(/[\\()]/g, '\\$&');

const buildTravelReportPdf = async (payload) => {
  try {
    const statistics = payload.statistics || {};
    const travelByCategory = payload.travelByCategory || [];
    const travelByDepartment = payload.travelByDepartment || [];
    const employeeTravelInfo = payload.employeeTravelInfo || [];
    const employeesOnTravel = payload.employeesOnTravel || [];
    const travelSummary = payload.travelSummary || null;

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
    page.drawText('TRAVEL REPORT', {
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
      { label: 'Approved Trips', value: statistics.approvedTrips || 0, color: emeraldColor },
      { label: 'Pending Trips', value: statistics.pendingTrips || 0, color: amberColor },
      { label: 'Total DSA', value: statistics.totalDSA || 0, color: purpleColor },
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
        // Dollar sign icon
        page.drawText('$', {
          x: iconX + 2,
          y: iconY + 5,
          size: iconSize,
          font: fontBold,
          color: stat.color,
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

    // Travel by Category - progress bars
    if (travelByCategory && travelByCategory.length > 0) {
      page.drawText('Travel by Category', {
        x: 50,
        y: y,
        size: 16,
        font: fontBold,
        color: primaryColor,
      });

      y -= 25;

      const maxTrips = Math.max(...travelByCategory.map(t => parseFloat(t.trip_count) || 0), 1);

      travelByCategory.forEach((item) => {
        const category = item.travel_category || 'N/A';
        const tripCount = Math.round(parseFloat(item.trip_count) || 0);
        const barWidth = ((tripCount / maxTrips) * (width - 200));

        // Label
        page.drawText(category, {
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
        page.drawText(`${tripCount} trips`, {
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

    // Travel by Department - progress bars
    if (travelByDepartment && travelByDepartment.length > 0) {
      // Check if there's enough space on page 1, otherwise move to page 2
      const spaceNeeded = 25 + (travelByDepartment.length * 32) + 20;
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

        page2.drawText('TRAVEL REPORT', {
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

        page2.drawText('Travel by Department', {
          x: 50,
          y: y2,
          size: 16,
          font: fontBold,
          color: primaryColor,
        });

        y2 -= 25;

        const maxTrips = Math.max(...travelByDepartment.map(d => parseFloat(d.trip_count) || 0), 1);

        travelByDepartment.forEach((item) => {
          const department = item.department || 'N/A';
          const tripCount = Math.round(parseFloat(item.trip_count) || 0);
          const barWidth = ((tripCount / maxTrips) * (width - 200));

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

          page2.drawText(`${tripCount} trips`, {
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
        page.drawText('Travel by Department', {
          x: 50,
          y: y,
          size: 16,
          font: fontBold,
          color: primaryColor,
        });

        y -= 25;

        const maxTrips = Math.max(...travelByDepartment.map(d => parseFloat(d.trip_count) || 0), 1);

        travelByDepartment.forEach((item) => {
          const department = item.department || 'N/A';
          const tripCount = Math.round(parseFloat(item.trip_count) || 0);
          const barWidth = ((tripCount / maxTrips) * (width - 200));

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

          page.drawText(`${tripCount} trips`, {
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

    // Add page 2 for Employee Travel Information
    const page2 = pdfDoc.addPage([612, 792]);
    let y2 = height - 50;

    // Header for page 2
    page2.drawText('Employee Travel Information (First 25)', {
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

    if (employeeTravelInfo && employeeTravelInfo.length > 0) {
      // Table header
      page2.drawText('Employee', { x: 50, y: y2, size: 9, font: fontBold, color: primaryColor });
      page2.drawText('Dept', { x: 130, y: y2, size: 9, font: fontBold, color: primaryColor });
      page2.drawText('Cat', { x: 180, y: y2, size: 9, font: fontBold, color: primaryColor });
      page2.drawText('Destination', { x: 220, y: y2, size: 9, font: fontBold, color: primaryColor });
      page2.drawText('DSA', { x: 320, y: y2, size: 9, font: fontBold, color: primaryColor });
      page2.drawText('Est Cost', { x: 380, y: y2, size: 9, font: fontBold, color: primaryColor });
      page2.drawText('Status', { x: 450, y: y2, size: 9, font: fontBold, color: primaryColor });

      y2 -= 15;

      employeeTravelInfo.slice(0, 25).forEach((emp) => {
        const empName = (emp.employee_name || 'N/A').substring(0, 15);
        const department = (emp.department || 'N/A').substring(0, 8);
        const category = emp.travel_category || 'N/A';
        const catAbbrev = category.substring(0, 2).toUpperCase();
        const destination = (emp.destination || 'N/A').substring(0, 10);
        const dsaAmount = emp.dsa_amount ? Math.round(parseFloat(emp.dsa_amount)).toLocaleString() : 'N/A';
        const estCost = emp.estimated_cost ? Math.round(parseFloat(emp.estimated_cost)).toLocaleString() : 'N/A';
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
        page2.drawText(catAbbrev, { x: 180, y: y2, size: 8, font: font, color: textColor });
        page2.drawText(destination, { x: 220, y: y2, size: 8, font: font, color: textColor });
        page2.drawText(dsaAmount, { x: 320, y: y2, size: 8, font: font, color: textColor });
        page2.drawText(estCost, { x: 380, y: y2, size: 8, font: font, color: textColor });
        page2.drawText(status, { x: 450, y: y2, size: 8, font: font, color: statusColor });

        y2 -= 12;

        // Add new page if running out of space
        if (y2 < 50) {
          const newPage = pdfDoc.addPage([612, 792]);
          y2 = height - 50;
          newPage.drawText('Employee Travel Information (continued)', {
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

    // Add page 3 for Travel Summary Statistics
    const page3 = pdfDoc.addPage([612, 792]);
    let y3 = height - 50;

    // Header for page 3
    page3.drawText('Travel Summary Statistics', {
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

    // Table header with better spacing and Reimbursement column - adjusted positions
    page3.drawText('Category', { x: 50, y: y3, size: 10, font: fontBold, color: primaryColor });
    page3.drawText('DSA', { x: 140, y: y3, size: 10, font: fontBold, color: primaryColor });
    page3.drawText('Accommodation', { x: 240, y: y3, size: 10, font: fontBold, color: primaryColor });
    page3.drawText('Other Costs', { x: 340, y: y3, size: 10, font: fontBold, color: primaryColor });
    page3.drawText('Reimbursement', { x: 430, y: y3, size: 10, font: fontBold, color: primaryColor });
    page3.drawText('Total', { x: 520, y: y3, size: 10, font: fontBold, color: primaryColor });

    y3 -= 15;

    // Draw table header border (only bottom line)
    page3.drawLine({
      start: { x: 45, y: y3 - 2 },
      end: { x: 565, y: y3 - 2 },
      thickness: 1,
      color: primaryColor,
    });

    y3 -= 20;

    // Function to format currency amounts - show multiple currencies
    const formatCurrencyAmounts = (amounts, category, field) => {
      if (!amounts || Object.keys(amounts).length === 0) return '-';
      
      // For East Africa and International, only DSA is in USD
      if ((category === 'East Africa' || category === 'International') && field === 'dsa') {
        const totalAmount = Object.values(amounts).reduce((sum, amt) => sum + amt, 0);
        if (totalAmount > 0) {
          return `${Math.round(totalAmount).toLocaleString()} USD`;
        }
        return '-';
      }
      
      return Object.entries(amounts).map(([currency, amount]) => 
        `${currency} ${Math.round(amount).toLocaleString()}`
      ).join(' + ');
    };

    // Function to calculate total by currency
    const calculateTotalByCurrency = (dsa, accommodation, other, reimbursement) => {
      const totalsByCurrency = {};
      
      Object.entries(dsa || {}).forEach(([currency, amount]) => {
        totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + amount;
      });
      Object.entries(accommodation || {}).forEach(([currency, amount]) => {
        totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + amount;
      });
      Object.entries(other || {}).forEach(([currency, amount]) => {
        totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + amount;
      });
      Object.entries(reimbursement || {}).forEach(([currency, amount]) => {
        totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + amount;
      });
      
      return totalsByCurrency;
    };

    // Function to format total with multiple currencies
    const formatTotalByCurrency = (totalsByCurrency, category) => {
      if (!totalsByCurrency || Object.keys(totalsByCurrency).length === 0) return '-';
      
      // For East Africa and International, show KES first then USD separately
      if (category === 'East Africa' || category === 'International') {
        const kesAmount = totalsByCurrency['KES'] || 0;
        const usdAmount = totalsByCurrency['USD'] || 0;
        
        let result = '';
        if (kesAmount > 0) {
          result += `KES ${Math.round(kesAmount).toLocaleString()}`;
        }
        if (usdAmount > 0) {
          if (result) result += ' + ';
          result += `${Math.round(usdAmount).toLocaleString()} USD`;
        }
        return result || '-';
      }
      
      return Object.entries(totalsByCurrency).map(([currency, amount]) => 
        `${currency} ${Math.round(amount).toLocaleString()}`
      ).join(' + ');
    };

    const categories = ['Within Kenya', 'East Africa', 'International', 'Local Movement'];

    categories.forEach((category, index) => {
      const catData = travelSummary?.byCategory?.[category] || { dsa: {}, accommodation: {}, other: {}, reimbursement: {} };
      const totalByCurrency = calculateTotalByCurrency(catData.dsa, catData.accommodation, catData.other, catData.reimbursement);

      // Alternating row highlight with increased height
      if (index % 2 === 0) {
        page3.drawRectangle({
          x: 45,
          y: y3 - 8,
          width: 520,
          height: 22,
          color: lightGray,
        });
      }

      page3.drawText(category, { x: 50, y: y3, size: 9, font: font, color: textColor });
      page3.drawText(formatCurrencyAmounts(catData.dsa, category, 'dsa'), { x: 140, y: y3, size: 8, font: font, color: textColor });
      page3.drawText((category === 'Within Kenya' || category === 'Local Movement') ? '-' : formatCurrencyAmounts(catData.accommodation, category, 'accommodation'), { x: 240, y: y3, size: 8, font: font, color: textColor });
      page3.drawText(formatCurrencyAmounts(catData.other, category, 'other'), { x: 340, y: y3, size: 8, font: font, color: textColor });
      page3.drawText(formatCurrencyAmounts(catData.reimbursement, category, 'reimbursement'), { x: 430, y: y3, size: 8, font: font, color: textColor });
      page3.drawText(formatTotalByCurrency(totalByCurrency, category), { x: 520, y: y3, size: 8, font: fontBold, color: textColor });

      y3 -= 22;
    });

    y3 -= 15;

    // Footer row with grand total - increased height, no border
    page3.drawRectangle({
      x: 45,
      y: y3 - 30,
      width: 520,
      height: 40,
      color: emeraldColor,
    });

    const totalDSA = travelSummary?.totals?.dsa || {};
    const totalAccommodation = travelSummary?.totals?.accommodation || {};
    const totalOther = travelSummary?.totals?.other || {};
    const totalReimbursement = travelSummary?.totals?.reimbursement || {};
    const grandTotalByCurrency = calculateTotalByCurrency(totalDSA, totalAccommodation, totalOther, totalReimbursement);

    // Calculate USD-forced DSA totals from East Africa and International
    const eastAfricaDSA = travelSummary?.byCategory?.['East Africa']?.dsa || {};
    const internationalDSA = travelSummary?.byCategory?.['International']?.dsa || {};
    const forcedUSDTotal = Object.values(eastAfricaDSA).reduce((sum, amt) => sum + amt, 0) + 
                          Object.values(internationalDSA).reduce((sum, amt) => sum + amt, 0);
    
    // Calculate KES DSA (excluding East Africa and International)
    const withinKenyaDSA = travelSummary?.byCategory?.['Within Kenya']?.dsa || {};
    const localMovementDSA = travelSummary?.byCategory?.['Local Movement']?.dsa || {};
    const kesDSATotal = Object.values(withinKenyaDSA).reduce((sum, amt) => sum + amt, 0) + 
                       Object.values(localMovementDSA).reduce((sum, amt) => sum + amt, 0);

    // Format DSA total with KES first, then USD
    let dsaTotalText = '';
    if (kesDSATotal > 0) {
      dsaTotalText += `KES ${Math.round(kesDSATotal).toLocaleString()}`;
    }
    if (forcedUSDTotal > 0) {
      if (dsaTotalText) dsaTotalText += ' + ';
      dsaTotalText += `${Math.round(forcedUSDTotal).toLocaleString()} USD`;
    }
    if (!dsaTotalText) dsaTotalText = '-';

    // Calculate grand total from row components (not column totals)
    // Sum all category totals to get the true grand total
    let grandKesTotal = 0;
    let grandUsdTotal = 0;
    
    categories.forEach(category => {
      const catData = travelSummary?.byCategory?.[category] || { dsa: {}, accommodation: {}, other: {}, reimbursement: {} };
      
      // For East Africa and International, DSA is forced to USD
      if (category === 'East Africa' || category === 'International') {
        grandUsdTotal += Object.values(catData.dsa || {}).reduce((sum, amt) => sum + amt, 0);
        grandKesTotal += (catData.accommodation['KES'] || 0) + (catData.other['KES'] || 0) + (catData.reimbursement['KES'] || 0);
        grandUsdTotal += (catData.accommodation['USD'] || 0) + (catData.other['USD'] || 0) + (catData.reimbursement['USD'] || 0);
      } else {
        grandKesTotal += Object.values(catData.dsa || {}).reduce((sum, amt) => sum + amt, 0);
        grandKesTotal += (catData.accommodation['KES'] || 0) + (catData.other['KES'] || 0) + (catData.reimbursement['KES'] || 0);
        grandUsdTotal += (catData.accommodation['USD'] || 0) + (catData.other['USD'] || 0) + (catData.reimbursement['USD'] || 0);
      }
    });
    
    let grandTotalText = '';
    if (grandKesTotal > 0) {
      grandTotalText += `KES ${Math.round(grandKesTotal).toLocaleString()}`;
    }
    if (grandUsdTotal > 0) {
      if (grandTotalText) grandTotalText += ' + ';
      grandTotalText += `${Math.round(grandUsdTotal).toLocaleString()} USD`;
    }
    if (!grandTotalText) grandTotalText = 'KES 0';

    // Move wordings down by 30% (from y/y-10 to y-3/y-13)
    page3.drawText('Total Money Spent', { x: 50, y: y3 - 3, size: 8, font: fontBold, color: white });
    page3.drawText('on Travels', { x: 50, y: y3 - 13, size: 8, font: fontBold, color: white });
    page3.drawText(dsaTotalText, { x: 140, y: y3 - 8, size: 7, font: fontBold, color: white });
    page3.drawText(formatCurrencyAmounts(totalAccommodation, null, null), { x: 240, y: y3 - 8, size: 7, font: fontBold, color: white });
    page3.drawText(formatCurrencyAmounts(totalOther, null, null), { x: 340, y: y3 - 8, size: 7, font: fontBold, color: white });
    page3.drawText(formatCurrencyAmounts(totalReimbursement, null, null), { x: 430, y: y3 - 8, size: 7, font: fontBold, color: white });
    
    // Grand total with KES on one line, USD on next
    const kesLine = grandKesTotal > 0 ? `KES ${Math.round(grandKesTotal).toLocaleString()}` : '';
    const usdLine = grandUsdTotal > 0 ? `${Math.round(grandUsdTotal).toLocaleString()} USD` : '';
    
    if (kesLine && usdLine) {
      page3.drawText(kesLine, { x: 520, y: y3 - 5, size: 7, font: fontBold, color: white });
      page3.drawText(usdLine, { x: 520, y: y3 - 15, size: 7, font: fontBold, color: white });
    } else if (kesLine) {
      page3.drawText(kesLine, { x: 520, y: y3 - 8, size: 8, font: fontBold, color: white });
    } else if (usdLine) {
      page3.drawText(usdLine, { x: 520, y: y3 - 8, size: 8, font: fontBold, color: white });
    } else {
      page3.drawText('KES 0', { x: 520, y: y3 - 8, size: 8, font: fontBold, color: white });
    }

    // Footer for page 3
    page3.drawText('KEREA HRMS - Confidential Document', {
      x: 50,
      y: 30,
      size: 10,
      font: font,
      color: primaryColor,
    });

    // Add page 4 for Employees Currently on Travel
    const page4 = pdfDoc.addPage([612, 792]);
    let y4 = height - 50;

    // Header for page 4
    page4.drawText('Employees Currently on Travel', {
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

    if (employeesOnTravel && employeesOnTravel.length > 0) {
      employeesOnTravel.forEach((emp) => {
        const empName = emp.employee_name || 'N/A';
        const empNo = emp.employee_no || 'N/A';
        const category = emp.travel_category || 'N/A';
        const startDate = emp.start_date ? new Date(emp.start_date).toLocaleDateString() : 'N/A';
        const endDate = emp.end_date ? new Date(emp.end_date).toLocaleDateString() : 'N/A';

        page4.drawText(`${empName} (${empNo})`, {
          x: 50,
          y: y4,
          size: 10,
          font: fontBold,
          color: textColor,
        });

        page4.drawText(`${category}: ${startDate} to ${endDate}`, {
          x: 50,
          y: y4 - 12,
          size: 9,
          font: font,
          color: textColor,
        });

        y4 -= 30;
      });
    } else {
      page4.drawText('No employees currently on travel.', {
        x: 50,
        y: y4,
        size: 10,
        font: font,
        color: textColor,
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
    console.error('Error building travel report PDF:', error);
    throw error;
  }
};

const getTravelReportFilters = async (req, res, next) => {
  try {
    // Get departments
    const departmentsResult = await query(`
      SELECT id, name FROM departments WHERE is_deleted = FALSE ORDER BY name
    `);

    // Get employees
    const employeesResult = await query(`
      SELECT id, first_name, last_name, employee_no 
      FROM users 
      WHERE is_deleted = FALSE 
      ORDER BY first_name, last_name
    `);

    // Get statuses
    const statuses = [
      { value: 'pending', label: 'Pending' },
      { value: 'approved', label: 'Approved' },
      { value: 'rejected', label: 'Rejected' },
      { value: 'cancelled', label: 'Cancelled' }
    ];

    res.json({
      departments: departmentsResult.rows,
      employees: employeesResult.rows.map(emp => ({
        id: emp.id,
        name: `${emp.first_name} ${emp.last_name}`,
        employee_no: emp.employee_no
      })),
      statuses
    });
  } catch (error) {
    next(error);
  }
};

const getTravelReportData = async (req, res, next) => {
  try {
    const { startDate, endDate, employeeId, departmentId, travelCategory, status } = req.query;

    // Build WHERE clauses
    const clauses = [];
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      clauses.push(`tr.start_date >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      clauses.push(`tr.end_date <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    if (employeeId) {
      clauses.push(`tr.user_id = $${paramIndex}`);
      params.push(employeeId);
      paramIndex++;
    }

    if (departmentId) {
      clauses.push(`u.department_id = $${paramIndex}`);
      params.push(departmentId);
      paramIndex++;
    }

    if (travelCategory) {
      clauses.push(`tr.travel_category = $${paramIndex}`);
      params.push(travelCategory);
      paramIndex++;
    }

    if (status) {
      clauses.push(`tr.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    // Get statistics
    const [totalEmployees, approvedTrips, pendingTrips, totalDSA] = await Promise.all([
      query(`SELECT COUNT(DISTINCT tr.user_id) as count FROM travel_requests tr INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE ${whereClause}`, params),
      query(`SELECT COUNT(*) as count FROM travel_requests tr INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE WHERE tr.status = 'approved' ${whereClause ? 'AND ' + whereClause.replace('WHERE ', '') : ''}`, params),
      query(`SELECT COUNT(*) as count FROM travel_requests tr INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE WHERE tr.status = 'pending' ${whereClause ? 'AND ' + whereClause.replace('WHERE ', '') : ''}`, params),
      query(`SELECT COALESCE(SUM(tr.dsa_amount), 0) as total FROM travel_requests tr INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE ${whereClause}`, params)
    ]);

    // Get travel by category
    const travelByCategoryResult = await query(`
      SELECT tr.travel_category, COUNT(*) as trip_count
      FROM travel_requests tr
      INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE
      ${whereClause}
      GROUP BY tr.travel_category
      ORDER BY trip_count DESC
    `, params);

    // Get travel by department
    const travelByDepartmentResult = await query(`
      SELECT d.name as department, COUNT(*) as trip_count
      FROM travel_requests tr
      INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE
      LEFT JOIN departments d ON d.id = u.department_id
      ${whereClause}
      GROUP BY d.name
      ORDER BY trip_count DESC
    `, params);

    // Get employee travel information
    const employeeTravelInfoResult = await query(`
      SELECT 
        tr.id as request_id,
        u.first_name || ' ' || u.last_name as employee_name,
        u.employee_no,
        d.name as department,
        tr.travel_category,
        tr.destination,
        tr.dsa_amount,
        tr.estimated_cost,
        tr.status as current_status
      FROM travel_requests tr
      INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE
      LEFT JOIN departments d ON d.id = u.department_id
      ${whereClause}
      ORDER BY tr.created_at DESC
      LIMIT 25
    `, params);

    // Get employees currently on travel
    const employeesOnTravelResult = await query(`
      SELECT
        u.first_name || ' ' || u.last_name as employee_name,
        u.employee_no,
        tr.travel_category,
        tr.start_date,
        tr.end_date
      FROM travel_requests tr
      INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE
      WHERE tr.status = 'approved'
        AND tr.start_date <= CURRENT_DATE
        AND tr.end_date >= CURRENT_DATE
      ORDER BY tr.end_date ASC
    `);

    // Get travel summary statistics by category and currency (all approved requests)
    const travelSummaryResult = await query(`
      SELECT
        tr.travel_category,
        tr.currency,
        COALESCE(SUM(tr.dsa_amount), 0) as total_dsa,
        COALESCE(SUM(tr.accommodation_amount), 0) as total_accommodation,
        COALESCE(SUM(tr.transportation_cost), 0) as total_other,
        0 as total_reimbursement
      FROM travel_requests tr
      INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE
      WHERE tr.status = 'approved'
      GROUP BY tr.travel_category, tr.currency
      ORDER BY tr.travel_category, tr.currency
    `);

    // Group summary by trip type
    const summaryByCategory = {
      'Within Kenya': { dsa: {}, accommodation: 0, other: {}, reimbursement: {} },
      'East Africa': { dsa: {}, accommodation: {}, other: {}, reimbursement: {} },
      'International': { dsa: {}, accommodation: {}, other: {}, reimbursement: {} },
      'Local Movement': { dsa: {}, accommodation: 0, other: {}, reimbursement: {} }
    };

    travelSummaryResult.rows.forEach(row => {
      const category = row.travel_category || 'Unknown';
      const currency = row.currency || 'KES';
      
      if (!summaryByCategory[category]) {
        summaryByCategory[category] = { dsa: {}, accommodation: {}, other: {}, reimbursement: {} };
      }

      if (category === 'Within Kenya' || category === 'Local Movement') {
        // No accommodation for these
        summaryByCategory[category].dsa[currency] = (summaryByCategory[category].dsa[currency] || 0) + parseFloat(row.total_dsa || 0);
        summaryByCategory[category].other[currency] = (summaryByCategory[category].other[currency] || 0) + parseFloat(row.total_other || 0);
        summaryByCategory[category].reimbursement[currency] = (summaryByCategory[category].reimbursement[currency] || 0) + parseFloat(row.total_reimbursement || 0);
      } else {
        summaryByCategory[category].dsa[currency] = (summaryByCategory[category].dsa[currency] || 0) + parseFloat(row.total_dsa || 0);
        summaryByCategory[category].accommodation[currency] = (summaryByCategory[category].accommodation[currency] || 0) + parseFloat(row.total_accommodation || 0);
        summaryByCategory[category].other[currency] = (summaryByCategory[category].other[currency] || 0) + parseFloat(row.total_other || 0);
        summaryByCategory[category].reimbursement[currency] = (summaryByCategory[category].reimbursement[currency] || 0) + parseFloat(row.total_reimbursement || 0);
      }
    });

    // Calculate totals by currency
    const totalsByCurrency = { dsa: {}, accommodation: {}, other: {}, reimbursement: {} };
    Object.values(summaryByCategory).forEach(category => {
      Object.entries(category.dsa || {}).forEach(([currency, amount]) => {
        totalsByCurrency.dsa[currency] = (totalsByCurrency.dsa[currency] || 0) + amount;
      });
      Object.entries(category.accommodation || {}).forEach(([currency, amount]) => {
        totalsByCurrency.accommodation[currency] = (totalsByCurrency.accommodation[currency] || 0) + amount;
      });
      Object.entries(category.other || {}).forEach(([currency, amount]) => {
        totalsByCurrency.other[currency] = (totalsByCurrency.other[currency] || 0) + amount;
      });
      Object.entries(category.reimbursement || {}).forEach(([currency, amount]) => {
        totalsByCurrency.reimbursement[currency] = (totalsByCurrency.reimbursement[currency] || 0) + amount;
      });
    });

    res.json({
      statistics: {
        totalEmployees: totalEmployees.rows[0]?.count || 0,
        approvedTrips: approvedTrips.rows[0]?.count || 0,
        pendingTrips: pendingTrips.rows[0]?.count || 0,
        totalDSA: Math.round(totalDSA.rows[0]?.total || 0)
      },
      travelByCategory: travelByCategoryResult.rows,
      travelByDepartment: travelByDepartmentResult.rows,
      employeeTravelInfo: employeeTravelInfoResult.rows,
      employeesOnTravel: employeesOnTravelResult.rows,
      travelSummary: {
        byCategory: summaryByCategory,
        totals: totalsByCurrency
      }
    });
  } catch (error) {
    next(error);
  }
};

const exportTravelReportPdf = async (req, res, next) => {
  try {
    const { startDate, endDate, employeeId, departmentId, travelCategory, status } = req.query;

    // Build WHERE clauses
    const clauses = [];
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      clauses.push(`tr.start_date >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      clauses.push(`tr.end_date <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    if (employeeId) {
      clauses.push(`tr.user_id = $${paramIndex}`);
      params.push(employeeId);
      paramIndex++;
    }

    if (departmentId) {
      clauses.push(`u.department_id = $${paramIndex}`);
      params.push(departmentId);
      paramIndex++;
    }

    if (travelCategory) {
      clauses.push(`tr.travel_category = $${paramIndex}`);
      params.push(travelCategory);
      paramIndex++;
    }

    if (status) {
      clauses.push(`tr.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    // Get statistics
    const [totalEmployees, approvedTrips, pendingTrips, totalDSA] = await Promise.all([
      query(`SELECT COUNT(DISTINCT tr.user_id) as count FROM travel_requests tr INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE ${whereClause}`, params),
      query(`SELECT COUNT(*) as count FROM travel_requests tr INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE WHERE tr.status = 'approved' ${whereClause ? 'AND ' + whereClause.replace('WHERE ', '') : ''}`, params),
      query(`SELECT COUNT(*) as count FROM travel_requests tr INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE WHERE tr.status = 'pending' ${whereClause ? 'AND ' + whereClause.replace('WHERE ', '') : ''}`, params),
      query(`SELECT COALESCE(SUM(tr.dsa_amount), 0) as total FROM travel_requests tr INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE ${whereClause}`, params)
    ]);

    // Get travel by category
    const travelByCategoryResult = await query(`
      SELECT tr.travel_category, COUNT(*) as trip_count
      FROM travel_requests tr
      INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE
      ${whereClause}
      GROUP BY tr.travel_category
      ORDER BY trip_count DESC
    `, params);

    // Get travel by department
    const travelByDepartmentResult = await query(`
      SELECT d.name as department, COUNT(*) as trip_count
      FROM travel_requests tr
      INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE
      LEFT JOIN departments d ON d.id = u.department_id
      ${whereClause}
      GROUP BY d.name
      ORDER BY trip_count DESC
    `, params);

    // Get employee travel information
    const employeeTravelInfoResult = await query(`
      SELECT 
        tr.id as request_id,
        u.first_name || ' ' || u.last_name as employee_name,
        u.employee_no,
        d.name as department,
        tr.travel_category,
        tr.destination,
        tr.dsa_amount,
        tr.estimated_cost,
        tr.status as current_status
      FROM travel_requests tr
      INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE
      LEFT JOIN departments d ON d.id = u.department_id
      ${whereClause}
      ORDER BY tr.created_at DESC
      LIMIT 25
    `, params);

    // Get employees currently on travel
    const employeesOnTravelResult = await query(`
      SELECT 
        u.first_name || ' ' || u.last_name as employee_name,
        u.employee_no,
        tr.travel_category,
        tr.start_date,
        tr.end_date
      FROM travel_requests tr
      INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE
      WHERE tr.status = 'approved'
        AND tr.start_date <= CURRENT_DATE
        AND tr.end_date >= CURRENT_DATE
      ORDER BY tr.end_date ASC
    `);

    // Get travel summary statistics by category and currency (all approved requests)
    const travelSummaryResult = await query(`
      SELECT
        tr.travel_category,
        tr.currency,
        COALESCE(SUM(tr.dsa_amount), 0) as total_dsa,
        COALESCE(SUM(tr.accommodation_amount), 0) as total_accommodation,
        COALESCE(SUM(tr.transportation_cost), 0) as total_other,
        0 as total_reimbursement
      FROM travel_requests tr
      INNER JOIN users u ON u.id = tr.user_id AND u.is_deleted = FALSE
      WHERE tr.status = 'approved'
      GROUP BY tr.travel_category, tr.currency
      ORDER BY tr.travel_category, tr.currency
    `);

    // Group summary by trip type
    const summaryByCategory = {
      'Within Kenya': { dsa: {}, accommodation: 0, other: {}, reimbursement: {} },
      'East Africa': { dsa: {}, accommodation: {}, other: {}, reimbursement: {} },
      'International': { dsa: {}, accommodation: {}, other: {}, reimbursement: {} },
      'Local Movement': { dsa: {}, accommodation: 0, other: {}, reimbursement: {} }
    };

    travelSummaryResult.rows.forEach(row => {
      const category = row.travel_category || 'Unknown';
      const currency = row.currency || 'KES';
      
      if (!summaryByCategory[category]) {
        summaryByCategory[category] = { dsa: {}, accommodation: {}, other: {}, reimbursement: {} };
      }

      if (category === 'Within Kenya' || category === 'Local Movement') {
        // No accommodation for these
        summaryByCategory[category].dsa[currency] = (summaryByCategory[category].dsa[currency] || 0) + parseFloat(row.total_dsa || 0);
        summaryByCategory[category].other[currency] = (summaryByCategory[category].other[currency] || 0) + parseFloat(row.total_other || 0);
        summaryByCategory[category].reimbursement[currency] = (summaryByCategory[category].reimbursement[currency] || 0) + parseFloat(row.total_reimbursement || 0);
      } else {
        summaryByCategory[category].dsa[currency] = (summaryByCategory[category].dsa[currency] || 0) + parseFloat(row.total_dsa || 0);
        summaryByCategory[category].accommodation[currency] = (summaryByCategory[category].accommodation[currency] || 0) + parseFloat(row.total_accommodation || 0);
        summaryByCategory[category].other[currency] = (summaryByCategory[category].other[currency] || 0) + parseFloat(row.total_other || 0);
        summaryByCategory[category].reimbursement[currency] = (summaryByCategory[category].reimbursement[currency] || 0) + parseFloat(row.total_reimbursement || 0);
      }
    });

    // Calculate totals by currency
    const totalsByCurrency = { dsa: {}, accommodation: {}, other: {}, reimbursement: {} };
    Object.values(summaryByCategory).forEach(category => {
      Object.entries(category.dsa || {}).forEach(([currency, amount]) => {
        totalsByCurrency.dsa[currency] = (totalsByCurrency.dsa[currency] || 0) + amount;
      });
      Object.entries(category.accommodation || {}).forEach(([currency, amount]) => {
        totalsByCurrency.accommodation[currency] = (totalsByCurrency.accommodation[currency] || 0) + amount;
      });
      Object.entries(category.other || {}).forEach(([currency, amount]) => {
        totalsByCurrency.other[currency] = (totalsByCurrency.other[currency] || 0) + amount;
      });
      Object.entries(category.reimbursement || {}).forEach(([currency, amount]) => {
        totalsByCurrency.reimbursement[currency] = (totalsByCurrency.reimbursement[currency] || 0) + amount;
      });
    });

    const payload = {
      statistics: {
        totalEmployees: totalEmployees.rows[0]?.count || 0,
        approvedTrips: approvedTrips.rows[0]?.count || 0,
        pendingTrips: pendingTrips.rows[0]?.count || 0,
        totalDSA: Math.round(totalDSA.rows[0]?.total || 0)
      },
      travelByCategory: travelByCategoryResult.rows,
      travelByDepartment: travelByDepartmentResult.rows,
      employeeTravelInfo: employeeTravelInfoResult.rows,
      employeesOnTravel: employeesOnTravelResult.rows,
      travelSummary: {
        byCategory: summaryByCategory,
        totals: totalsByCurrency
      }
    };

    const pdfBuffer = await buildTravelReportPdf(payload);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="kerea-travel-report-${new Date().toISOString().slice(0, 10)}.pdf"`);
    res.send(pdfBuffer);

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'TRAVEL_REPORT_EXPORT',
      entityType: 'travel_report',
      entityId: null,
      description: `${req.user.fullName} exported travel report.`,
      metadata: { filters: { startDate, endDate, employeeId, departmentId, travelCategory, status } },
      ipAddress: req.ip
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTravelReportFilters,
  getTravelReportData,
  exportTravelReportPdf
};
