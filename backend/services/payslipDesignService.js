const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const GREEN = rgb(0.09, 0.35, 0.2);
const LIGHT_GREEN = rgb(0.87, 0.94, 0.89);
const ALT_ROW = rgb(0.949, 0.949, 0.949);
const CREAM = rgb(0.988, 0.961, 0.886);
const AMBER = rgb(0.706, 0.325, 0.035);
const BORDER = rgb(0.78, 0.82, 0.8);
const BLACK = rgb(0.13, 0.13, 0.13);
const GREY = rgb(0.42, 0.45, 0.44);
const WHITE = rgb(1, 1, 1);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 34;
const CONTENT_W = PAGE_W - MARGIN * 2;
const GAP = 12;
const COL_W = (CONTENT_W - GAP) / 2;

const DASH = '\u2014';

const generateSystemPayslip = async ({ employee, profile, period, values }) => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

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
  const cellBorder = (x, yPos, w, h) => {
    page.drawRectangle({ x, y: yPos, width: w, height: h, borderColor: BORDER, borderWidth: 0.5 });
  };

  // ===== Banner =====
  const bannerH = 50;
  rect(MARGIN, y - bannerH, CONTENT_W, bannerH, GREEN);
  textCenter('KENYA RENEWABLE ENERGY ASSOCIATION', PAGE_W / 2, y - 21, 13, bold, WHITE);
  textCenter(`EMPLOYEE PAY SLIP ${DASH} ${periodLabel.toUpperCase()}`, PAGE_W / 2, y - 38, 9.5, bold, LIGHT_GREEN);
  y -= bannerH + 10;

  const sectionBar = (title, x, w, yPos) => {
    rect(x, yPos - 18, w, 18, GREEN);
    text(title, x + 8, yPos - 13, 9, bold, WHITE);
    return yPos - 18;
  };

  // ===== Employee Information =====
  y = sectionBar('EMPLOYEE INFORMATION', MARGIN, CONTENT_W, y);
  const infoLeft = [
    ['Employee No.', values.employeeNo],
    ['Full Name', values.fullName],
    ['Department', values.department],
    ['Pay Period', periodLabel],
    ['Payment Mode', values.paymentMode]
  ];
  const infoRight = [
    ['ID Number', values.idNumber],
    ['KRA PIN', values.kraPin],
    ['NSSF No.', values.nssfNumber],
    ['SHIF No.', values.shifNumber],
    ['Job Title', values.jobTitle]
  ];
  const infoRowH = 15;
  infoLeft.forEach((row, i) => {
    const ry = y - infoRowH * (i + 1);
    if (i % 2 === 1) {
      rect(MARGIN, ry, CONTENT_W, infoRowH, ALT_ROW);
    }
    cellBorder(MARGIN, ry, COL_W + GAP / 2, infoRowH);
    cellBorder(MARGIN + COL_W + GAP / 2, ry, COL_W + GAP / 2, infoRowH);
    text(row[0], MARGIN + 6, ry + 4.5, 7.5, font, GREY);
    textRight(row[1], MARGIN + COL_W + GAP / 2 - 6, ry + 4.5, 8, bold, BLACK);
    const rrow = infoRight[i];
    text(rrow[0], MARGIN + COL_W + GAP / 2 + 6, ry + 4.5, 7.5, font, GREY);
    textRight(rrow[1], MARGIN + CONTENT_W - 6, ry + 4.5, 8, bold, BLACK);
  });
  y -= infoRowH * infoLeft.length + 12;

  // ===== Table helper =====
  const drawTable = (x, w, title, rightHeader, rows, yStart) => {
    let ty = sectionBar(title, x, w, yStart);
    // header row
    rect(x, ty - 15, w, 15, GREEN);
    text('Description', x + 6, ty - 10.5, 7.5, bold, WHITE);
    textRight(rightHeader, x + w - 6, ty - 10.5, 7.5, bold, WHITE);
    ty -= 15;
    rows.forEach((row, i) => {
      const rowH = 14;
      const ry = ty - rowH;
      if (row.kind === 'total' || row.kind === 'highlight') {
        rect(x, ry, w, rowH, LIGHT_GREEN);
      } else if (i % 2 === 1) {
        rect(x, ry, w, rowH, ALT_ROW);
      }
      cellBorder(x, ry, w, rowH);
      const isBold = row.kind === 'total' || row.kind === 'highlight';
      text(row.label, x + 6, ry + 4, 7.5, isBold ? bold : font, isBold ? GREEN : BLACK);
      textRight(row.amount ?? '', x + w - 6, ry + 4, 8, isBold ? bold : font, isBold ? GREEN : BLACK);
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

  const afterStat = drawTable(MARGIN, COL_W, 'STATUTORY DEDUCTIONS', 'Amount (KES)', statRows, y);
  const afterPaye = drawTable(MARGIN + COL_W + GAP, COL_W, 'PAYE COMPUTATION', 'Amount (KES)', payeRows, y);
  y = Math.min(afterStat, afterPaye) - 12;

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
        : ''
    }))
    : [{ label: 'None', amount: '' }];

  const afterEarn = drawTable(MARGIN, COL_W, 'EARNINGS', 'Amount (KES)', earnRows, y);
  const afterContrib = drawTable(MARGIN + COL_W + GAP, COL_W, 'OTHER CONTRIBUTIONS', 'Amount (KES)', contribRows, y);
  y = Math.min(afterEarn, afterContrib) - 12;

  // ===== Net Pay Summary =====
  y = sectionBar('NET PAY SUMMARY', MARGIN, CONTENT_W, y);
  const cellW = CONTENT_W / 3;
  const summaryH = 36;
  const sy = y - summaryH;
  rect(MARGIN, sy, cellW, summaryH, LIGHT_GREEN);
  rect(MARGIN + cellW, sy, cellW, summaryH, CREAM);
  rect(MARGIN + cellW * 2, sy, cellW, summaryH, GREEN);
  cellBorder(MARGIN, sy, CONTENT_W, summaryH);
  textCenter('Gross Earnings', MARGIN + cellW / 2, sy + 22, 7.5, font, GREEN);
  textCenter(values.totalEarnings, MARGIN + cellW / 2, sy + 8, 11, bold, GREEN);
  textCenter('Total Deductions', MARGIN + cellW * 1.5, sy + 22, 7.5, font, AMBER);
  textCenter(values.totalDeductions, MARGIN + cellW * 1.5, sy + 8, 11, bold, AMBER);
  textCenter('NET PAY', MARGIN + cellW * 2.5, sy + 22, 7.5, bold, LIGHT_GREEN);
  textCenter(values.netPay, MARGIN + cellW * 2.5, sy + 8, 11, bold, WHITE);
  y = sy - 14;

  // ===== Acknowledgement & Authorisation =====
  y = sectionBar('ACKNOWLEDGEMENT & AUTHORISATION', MARGIN, CONTENT_W, y);
  y -= 34;
  const half = CONTENT_W / 2;
  const lineW = half - 50;
  page.drawLine({
    start: { x: MARGIN + 10, y }, end: { x: MARGIN + 10 + lineW, y }, thickness: 0.7, color: BLACK
  });
  page.drawLine({
    start: { x: MARGIN + half + 40, y }, end: { x: MARGIN + half + 40 + lineW, y }, thickness: 0.7, color: BLACK
  });
  text(employee.fullName || '', MARGIN + 10, y - 11, 8, bold, BLACK);
  text('Employee Signature', MARGIN + 10, y - 21, 7, font, GREY);
  text(`Date: ${dateLabel}`, MARGIN + 10, y - 30, 6, font, GREY);
  text('HR / Finance', MARGIN + half + 40, y - 11, 8, bold, BLACK);
  text('Authorised By', MARGIN + half + 40, y - 21, 7, font, GREY);
  text(`Date: ${dateLabel}`, MARGIN + half + 40, y - 30, 6, font, GREY);

  return Buffer.from(await doc.save());
};

module.exports = { generateSystemPayslip };
