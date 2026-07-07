const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const BANNER_GREEN = rgb(0.18, 0.47, 0.3);
const BAR_GREEN = rgb(0.1, 0.4, 0.22);
const DARK_GREEN = rgb(0.09, 0.35, 0.2);
const LIGHT_GREEN = rgb(0.87, 0.94, 0.89);
const PALE_GREEN = rgb(0.93, 0.965, 0.94);
const ALT_ROW = rgb(0.955, 0.955, 0.955);
const CREAM = rgb(0.988, 0.961, 0.886);
const AMBER = rgb(0.706, 0.325, 0.035);
const BORDER = rgb(0.82, 0.86, 0.84);
const BLACK = rgb(0.13, 0.13, 0.13);
const GREY = rgb(0.45, 0.48, 0.47);
const WHITE = rgb(1, 1, 1);
const BANNER_SUB = rgb(0.78, 0.9, 0.82);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const GAP = 12;
const COL_W = (CONTENT_W - GAP) / 2;

const DASH = '\u2014';

const generateSystemPayslip = async ({ employee, profile, period, values }) => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const periodDate = new Date(`${period}-01T00:00:00`);
  const periodLabel = Number.isNaN(periodDate.getTime())
    ? period
    : periodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const endOfMonth = Number.isNaN(periodDate.getTime())
    ? new Date()
    : new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0);
  const dateLabel = endOfMonth.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  let y = PAGE_H - MARGIN;

  const text = (str, x, yPos, size, fnt, color) => {
    page.drawText(String(str ?? ''), { x, y: yPos, size, font: fnt, color });
  };
  const textRight = (str, xRight, yPos, size, fnt, color) => {
    const w = fnt.widthOfTextAtSize(String(str ?? ''), size);
    text(str, xRight - w, yPos, size, fnt, color);
  };
  const textCenter = (str, xCenter, yPos, size, fnt, color) => {
    const w = fnt.widthOfTextAtSize(String(str ?? ''), size);
    text(str, xCenter - w / 2, yPos, size, fnt, color);
  };
  const rect = (x, yPos, w, h, color) => {
    page.drawRectangle({ x, y: yPos, width: w, height: h, color });
  };
  const outline = (x, yPos, w, h, color, width = 0.8) => {
    page.drawRectangle({ x, y: yPos, width: w, height: h, borderColor: color, borderWidth: width });
  };
  const line = (x1, y1, x2, y2, color, width = 0.7) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: width, color });
  };

  // White mini-icons drawn before section titles (emoji-style, all white).
  const drawIcon = (type, x, cy) => {
    const s = 8; // icon box size
    const bx = x;
    const by = cy - s / 2;
    switch (type) {
      case 'doc': // note / booklet
        outline(bx, by, s - 1.5, s, WHITE, 0.9);
        line(bx + 1.5, by + s - 2.2, bx + s - 3, by + s - 2.2, WHITE, 0.7);
        line(bx + 1.5, by + s - 4.2, bx + s - 3, by + s - 4.2, WHITE, 0.7);
        line(bx + 1.5, by + s - 6.2, bx + s - 3, by + s - 6.2, WHITE, 0.7);
        break;
      case 'chart': // graph with bars
        outline(bx, by, s + 1, s, WHITE, 0.9);
        rect(bx + 1.6, by + 1, 1.6, 2.6, WHITE);
        rect(bx + 4, by + 1, 1.6, 4.4, WHITE);
        rect(bx + 6.4, by + 1, 1.6, 6, WHITE);
        break;
      case 'coin': // earnings
        page.drawEllipse({ x: bx + s / 2, y: cy, xScale: s / 2, yScale: s / 2, borderColor: WHITE, borderWidth: 0.9 });
        line(bx + s / 2, cy - 2.4, bx + s / 2, cy + 2.4, WHITE, 0.9);
        break;
      case 'building': // contributions
        outline(bx, by, s, s, WHITE, 0.9);
        rect(bx + 1.6, by + 4.6, 1.7, 1.7, WHITE);
        rect(bx + 4.7, by + 4.6, 1.7, 1.7, WHITE);
        rect(bx + 1.6, by + 1.6, 1.7, 1.7, WHITE);
        rect(bx + 4.7, by + 1.6, 1.7, 1.7, WHITE);
        break;
      case 'check': // net pay summary
        outline(bx, by, s, s, WHITE, 0.9);
        line(bx + 1.8, by + 3.8, bx + 3.4, by + 2, WHITE, 1);
        line(bx + 3.4, by + 2, bx + 6.4, by + 6, WHITE, 1);
        break;
      case 'pen': // acknowledgement
        line(bx + 0.5, by + 1, bx + 6.5, by + 7, WHITE, 1.1);
        line(bx + 0.5, by + 1, bx + 2.5, by + 0.6, WHITE, 1.1);
        line(bx + 5, by + 0.4, bx + 8, by + 0.4, WHITE, 0.8);
        break;
      default:
        break;
    }
  };

  // ===== Banner =====
  const bannerH = 58;
  rect(MARGIN, y - bannerH, CONTENT_W, bannerH, BANNER_GREEN);
  textCenter('KENYA RENEWABLE ENERGY ASSOCIATION', PAGE_W / 2, y - 20, 13, bold, WHITE);
  textCenter(`EMPLOYEE PAY SLIP ${DASH} ${periodLabel.toUpperCase()}`, PAGE_W / 2, y - 34, 9.5, font, BANNER_SUB);
  textCenter('P.O. Box 42040-00100, Nairobi | administrator@kerea.org | www.kerea.org', PAGE_W / 2, y - 47, 6.5, font, BANNER_SUB);
  y -= bannerH + 12;

  const sectionBar = (title, icon, x, w, yPos) => {
    rect(x, yPos - 19, w, 19, BAR_GREEN);
    drawIcon(icon, x + 8, yPos - 9.5);
    text(title, x + 22, yPos - 13, 9, bold, WHITE);
    return yPos - 19;
  };

  // ===== Employee Information =====
  // Label columns have a pale green background; no visible row lines.
  y = sectionBar('EMPLOYEE INFORMATION', 'doc', MARGIN, CONTENT_W, y);
  const infoLeft = [
    ['Employee No.', values.employeeNo],
    ['Full Name', values.fullName],
    ['Job Title', values.jobTitle],
    ['Department', values.department],
    ['Pay Period', periodLabel]
  ];
  const infoRight = [
    ['ID Number', values.idNumber],
    ['KRA PIN', values.kraPin],
    ['NSSF No.', values.nssfNumber],
    ['SHIF No.', values.shifNumber],
    ['Payment Mode', values.paymentMode]
  ];
  const infoRowH = 19;
  const infoH = infoRowH * infoLeft.length;
  const labelW = 105;
  const halfW = CONTENT_W / 2;
  // pale green label columns (continuous, no row borders)
  rect(MARGIN, y - infoH, labelW, infoH, PALE_GREEN);
  rect(MARGIN + halfW, y - infoH, labelW, infoH, PALE_GREEN);
  infoLeft.forEach((row, i) => {
    const ty = y - infoRowH * i - 13;
    text(row[0], MARGIN + 8, ty, 7.5, font, GREY);
    text(row[1], MARGIN + labelW + 10, ty, 8, bold, BLACK);
    const rrow = infoRight[i];
    text(rrow[0], MARGIN + halfW + 8, ty, 7.5, font, GREY);
    text(rrow[1], MARGIN + halfW + labelW + 10, ty, 8, bold, BLACK);
  });
  y -= infoH + 14;

  // ===== Table helper =====
  const drawTable = (x, w, title, icon, leftHeader, rows, yStart) => {
    let ty = sectionBar(title, icon, x, w, yStart);
    const dividerX = x + w * 0.45;
    rect(x, ty - 15, w, 15, BAR_GREEN);
    text(leftHeader, x + 6, ty - 10.5, 7.5, bold, WHITE);
    textRight('Amount (KES)', x + w - 6, ty - 10.5, 7.5, bold, WHITE);
    line(dividerX, ty - 15, dividerX, ty, WHITE, 0.5);
    ty -= 15;
    rows.forEach((row, i) => {
      const rowH = 15;
      const ry = ty - rowH;
      if (row.kind === 'total' || row.kind === 'highlight') {
        rect(x, ry, w, rowH, LIGHT_GREEN);
      } else if (i % 2 === 1) {
        rect(x, ry, w, rowH, ALT_ROW);
      }
      line(x, ry, x + w, ry, BORDER, 0.5);
      line(dividerX, ry, dividerX, ry + rowH, BORDER, 0.5);
      const isBold = row.kind === 'total' || row.kind === 'highlight';
      text(row.label, x + 6, ry + 4.5, 7.5, isBold ? bold : font, isBold ? DARK_GREEN : BLACK);
      textRight(row.amount ?? '', x + w - 6, ry + 4.5, 8, isBold ? bold : font, isBold ? DARK_GREEN : BLACK);
      ty = ry;
    });
    return ty;
  };

  const notDash = (v) => v && v !== DASH;

  // ===== Statutory Deductions | PAYE Computation =====
  const statRows = [
    notDash(values.paye) && { label: 'PAYE (Pay As You Earn)', amount: values.paye },
    notDash(values.nssf) && { label: 'NSSF (Tier I and Tier II)', amount: values.nssf },
    notDash(values.shif) && { label: 'SHIF (Social Health Insurance Fund)', amount: values.shif },
    notDash(values.housingLevy) && { label: 'Housing Levy', amount: values.housingLevy },
    notDash(values.pension) && { label: 'Pension', amount: values.pension },
    notDash(values.otherDeductions) && { label: 'Other Deductions', amount: values.otherDeductions },
    { label: 'Total Deductions', amount: values.totalDeductions, kind: 'total' }
  ].filter(Boolean);

  const payeRows = [
    { label: 'Total Earnings', amount: values.totalEarnings },
    { label: 'Less: Pre-Tax Deductions', amount: values.preTaxDeductions },
    { label: 'Taxable Pay', amount: values.taxablePay, kind: 'highlight' },
    { label: 'Less: Personal Relief', amount: values.personalRelief },
    { label: 'Less: Insurance Relief', amount: values.insuranceRelief },
    { label: 'PAYE Payable', amount: values.payePayable, kind: 'total' }
  ];

  const afterStat = drawTable(MARGIN, COL_W, 'STATUTORY DEDUCTIONS', 'doc', 'Description', statRows, y);
  const afterPaye = drawTable(MARGIN + COL_W + GAP, COL_W, 'PAYE COMPUTATION', 'chart', 'Item', payeRows, y);
  y = Math.min(afterStat, afterPaye) - 14;

  // ===== Earnings | Other Contributions =====
  const earnRows = [
    notDash(values.grossSalary) && { label: 'Basic / Gross Salary', amount: values.grossSalary },
    notDash(values.allowances) && { label: 'Allowances', amount: values.allowances },
    notDash(values.bonuses) && { label: 'Bonuses', amount: values.bonuses },
    notDash(values.overtime) && { label: 'Overtime', amount: values.overtime },
    notDash(values.gratuity) && { label: 'Gratuity', amount: values.gratuity },
    { label: 'Total Earnings', amount: values.totalEarnings, kind: 'total' }
  ].filter(Boolean);

  const contributions = (profile.otherContributions || []).slice(0, 6);
  const contribRows = contributions.length
    ? contributions.map((entry) => ({
      label: entry.label || DASH,
      amount: Number(entry.amount)
        ? Number(entry.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : DASH
    }))
    : [{ label: 'None', amount: '' }];

  const afterEarn = drawTable(MARGIN, COL_W, 'EARNINGS', 'coin', 'Description', earnRows, y);
  const afterContrib = drawTable(MARGIN + COL_W + GAP, COL_W, 'OTHER CONTRIBUTIONS', 'building', 'Description', contribRows, y);
  y = Math.min(afterEarn, afterContrib) - 14;

  // ===== Net Pay Summary =====
  y = sectionBar('NET PAY SUMMARY', 'check', MARGIN, CONTENT_W, y);
  const cellW = CONTENT_W / 3;
  const summaryH = 38;
  const sy = y - summaryH;
  rect(MARGIN, sy, cellW, summaryH, LIGHT_GREEN);
  rect(MARGIN + cellW, sy, cellW, summaryH, CREAM);
  rect(MARGIN + cellW * 2, sy, cellW, summaryH, BAR_GREEN);
  textCenter('Gross Earnings', MARGIN + cellW / 2, sy + 23, 7.5, font, DARK_GREEN);
  textCenter(`KES ${values.totalEarnings}`, MARGIN + cellW / 2, sy + 9, 11, bold, DARK_GREEN);
  textCenter('Total Deductions', MARGIN + cellW * 1.5, sy + 23, 7.5, font, AMBER);
  textCenter(`KES ${values.totalDeductions}`, MARGIN + cellW * 1.5, sy + 9, 11, bold, AMBER);
  textCenter('NET PAY', MARGIN + cellW * 2.5, sy + 23, 7.5, bold, LIGHT_GREEN);
  textCenter(`KES ${values.netPay}`, MARGIN + cellW * 2.5, sy + 9, 11, bold, WHITE);
  y = sy - 16;

  // ===== Acknowledgement & Authorisation =====
  y = sectionBar('ACKNOWLEDGEMENT & AUTHORISATION', 'pen', MARGIN, CONTENT_W, y);
  const ackH = 64;
  rect(MARGIN, y - ackH, CONTENT_W, ackH, PALE_GREEN);
  const halfAck = CONTENT_W / 2;
  const lineY = y - 22;
  const leftX = MARGIN + 12;
  const rightX = MARGIN + halfAck + 12;
  const sigLineW = halfAck - 40;
  line(leftX, lineY, leftX + sigLineW, lineY, DARK_GREEN, 0.8);
  line(rightX, lineY, rightX + sigLineW, lineY, DARK_GREEN, 0.8);
  text('Employee Signature', leftX, lineY - 10, 6.5, font, GREY);
  text(values.fullName || employee.fullName || '', leftX, lineY - 21, 8, bold, BLACK);
  text(`Date: ${dateLabel}`, leftX, lineY - 31, 6, font, GREY);
  text('Authorised by (HR / Finance)', rightX, lineY - 10, 6.5, font, GREY);
  text('Kenya Renewable Energy Association', rightX, lineY - 21, 8, bold, BLACK);
  text(`Date: ${dateLabel}`, rightX, lineY - 31, 6, font, GREY);
  y -= ackH + 22;

  // ===== Footer =====
  line(MARGIN, y + 8, MARGIN + CONTENT_W, y + 8, LIGHT_GREEN, 1);
  textCenter(
    `This payslip is computer-generated and does not require a physical signature unless otherwise stated.   |   Confidential ${DASH} For Recipient Use Only`,
    PAGE_W / 2,
    y - 4,
    6,
    italic,
    GREY
  );

  return Buffer.from(await doc.save());
};

module.exports = { generateSystemPayslip };
