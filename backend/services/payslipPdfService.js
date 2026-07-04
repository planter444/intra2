const { PDFDocument, StandardFonts, PDFName, PDFBool } = require('pdf-lib');

const DATA_KEYS = [
  { key: 'employeeNo', label: 'Employee Number' },
  { key: 'fullName', label: 'Full Name' },
  { key: 'idNumber', label: 'ID Number' },
  { key: 'department', label: 'Department' },
  { key: 'jobTitle', label: 'Job Title' },
  { key: 'kraPin', label: 'KRA PIN' },
  { key: 'nssfNumber', label: 'NSSF Number' },
  { key: 'shifNumber', label: 'SHIF Number' },
  { key: 'paymentMode', label: 'Payment Mode' },
  { key: 'payPeriod', label: 'Pay Period (e.g. December 2025)' },
  { key: 'payPeriodUpper', label: 'Pay Period - UPPERCASE (e.g. DECEMBER 2025)' },
  { key: 'headerTitle', label: 'Header Title (EMPLOYEE PAY SLIP \u2014 <PERIOD>)' },
  { key: 'grossSalary', label: 'Basic / Gross Salary' },
  { key: 'allowances', label: 'Allowances' },
  { key: 'bonuses', label: 'Bonuses' },
  { key: 'overtime', label: 'Overtime' },
  { key: 'gratuity', label: 'Gratuity' },
  { key: 'paye', label: 'PAYE' },
  { key: 'nssf', label: 'NSSF Deduction' },
  { key: 'shif', label: 'SHIF Deduction' },
  { key: 'housingLevy', label: 'Housing Levy' },
  { key: 'pension', label: 'Pension' },
  { key: 'otherDeductions', label: 'Other Deductions' },
  { key: 'taxablePay', label: 'Taxable Pay' },
  { key: 'preTaxDeductions', label: 'Pre-Tax Deductions' },
  { key: 'personalRelief', label: 'Personal Relief' },
  { key: 'insuranceRelief', label: 'Insurance Relief' },
  { key: 'payePayable', label: 'PAYE Payable' },
  { key: 'totalEarnings', label: 'Total Earnings / Gross Earnings' },
  { key: 'totalDeductions', label: 'Total Deductions' },
  { key: 'netPay', label: 'Net Pay' },
  { key: 'employeeSignatureName', label: 'Employee Name (Acknowledgement)' },
  { key: 'authorisedBy', label: 'Authorised By (HR / Finance)' },
  { key: 'employeeSignDate', label: 'Employee Signature Date' },
  { key: 'authorisedDate', label: 'Authorisation Date' },
  { key: 'contribution1Label', label: 'Other Contribution 1 - Name' },
  { key: 'contribution1Amount', label: 'Other Contribution 1 - Amount' },
  { key: 'contribution2Label', label: 'Other Contribution 2 - Name' },
  { key: 'contribution2Amount', label: 'Other Contribution 2 - Amount' },
  { key: 'contribution3Label', label: 'Other Contribution 3 - Name' },
  { key: 'contribution3Amount', label: 'Other Contribution 3 - Amount' },
  { key: 'contribution4Label', label: 'Other Contribution 4 - Name' },
  { key: 'contribution4Amount', label: 'Other Contribution 4 - Amount' },
  { key: 'contribution5Label', label: 'Other Contribution 5 - Name' },
  { key: 'contribution5Amount', label: 'Other Contribution 5 - Amount' }
];

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const listTemplateFields = async (fileBytes) => {
  const doc = await PDFDocument.load(fileBytes, { updateMetadata: false });
  const form = doc.getForm();
  return form.getFields().map((field) => ({
    name: field.getName(),
    type: field.constructor.name
  }));
};

const buildAutoFieldMap = (fieldNames) => {
  const fieldMap = {};
  fieldNames.forEach((name) => {
    const normalizedName = normalize(name);
    const match = DATA_KEYS.find((entry) => normalize(entry.key) === normalizedName)
      || DATA_KEYS.find((entry) => normalizedName.includes(normalize(entry.key)) || normalize(entry.key).includes(normalizedName));
    if (match) {
      fieldMap[name] = match.key;
    }
  });
  return fieldMap;
};

// Matches the font operator (e.g. "/Arial 9 Tf") inside a field's default appearance,
// so a repair can keep the template's original font name and size.
const TF_REGEX = /\/[^\s/]+\s+\d+(?:\.\d+)?\s+Tf/;

const repairDefaultAppearance = (field) => {
  let tf = null;
  try {
    const da = field.acroField.getDefaultAppearance() || '';
    const match = da.match(TF_REGEX);
    tf = match ? match[0] : null;
  } catch (error) {
    tf = null;
  }
  try {
    // Keep the template's own font name and size; only replace the broken
    // colour operator with black.
    field.acroField.setDefaultAppearance(`${tf || '/Helv 9 Tf'} 0 g`);
    return true;
  } catch (error) {
    return false;
  }
};

const fillTemplate = async (fileBytes, fieldMap, values, { flatten = true } = {}) => {
  const doc = await PDFDocument.load(fileBytes, { updateMetadata: false });
  const form = doc.getForm();
  const fallbackFont = await doc.embedFont(StandardFonts.Helvetica);
  const filledFields = [];

  Object.entries(fieldMap || {}).forEach(([fieldName, dataKey]) => {
    if (!dataKey) {
      return;
    }
    const value = values[dataKey];
    const text = value === undefined || value === null ? '' : String(value);

    let field;
    try {
      field = form.getTextField(fieldName);
    } catch (error) {
      return; // Field missing or not a text field - leave the template untouched for it.
    }

    try {
      field.setText(text);
    } catch (error) {
      // Broken appearance definition: repair it (keeping the original font and
      // size) and retry.
      if (!repairDefaultAppearance(field)) {
        return;
      }
      try {
        field.setText(text);
      } catch (retryError) {
        return;
      }
    }
    filledFields.push(field);
  });

  // Draw an appearance stream for every filled field so its value is ALWAYS
  // visible - including read-only/calculated fields that viewers refuse to
  // render themselves, and viewers that ignore NeedAppearances. Font size and
  // colour come from the field's own definition; broken definitions are
  // repaired keeping their original font and size.
  filledFields.forEach((field) => {
    try {
      field.updateAppearances(fallbackFont);
    } catch (error) {
      repairDefaultAppearance(field);
      try {
        field.updateAppearances(fallbackFont);
      } catch (retryError) {
        // Leave the field's previous appearance in place.
      }
    }
  });

  // NeedAppearances asks capable viewers (Chrome, Acrobat) to re-render every
  // value with the template's OWN font, exactly as designed, instead of the
  // fallback appearance stream drawn above.
  try {
    form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True);
  } catch (error) {
    // The fallback appearance streams still guarantee visibility.
  }

  if (flatten) {
    // Final payslip: do NOT flatten (flattening would permanently bake in the
    // fallback font). Instead lock every field: read-only fields cannot be
    // edited and are not highlighted with the bluish form background, while
    // NeedAppearances keeps the template's own font on screen and in print.
    form.getFields().forEach((field) => {
      try {
        field.enableReadOnly();
      } catch (readOnlyError) {
        // Leave as-is.
      }
    });
  }

  return Buffer.from(await doc.save({ updateFieldAppearances: false }));
};

const formatAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) {
    return '\u2014';
  }
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const buildPayslipValues = ({ employee, profile, period }) => {
  const totalEarnings = (profile.grossSalary || 0) + (profile.allowances || 0) + (profile.bonuses || 0)
    + (profile.overtime || 0) + (profile.gratuity || 0);
  const preTaxDeductions = (profile.nssf || 0) + (profile.shif || 0) + (profile.housingLevy || 0) + (profile.pension || 0);
  const taxablePay = totalEarnings - preTaxDeductions;
  const totalDeductions = (profile.paye || 0) + preTaxDeductions + (profile.otherDeductions || 0);
  const netPay = totalEarnings - totalDeductions;

  const periodDate = new Date(`${period}-01T00:00:00`);
  const periodLabel = Number.isNaN(periodDate.getTime())
    ? period
    : periodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const values = {
    employeeNo: employee.employeeNo || '\u2014',
    fullName: employee.fullName,
    idNumber: profile.idNumber || '\u2014',
    department: employee.departmentName || '\u2014',
    jobTitle: employee.positionTitle || employee.roleTitle || '\u2014',
    kraPin: profile.kraPin || '\u2014',
    nssfNumber: profile.nssfNumber || '\u2014',
    shifNumber: profile.shifNumber || '\u2014',
    paymentMode: profile.paymentMode || 'Bank Transfer',
    payPeriod: periodLabel,
    payPeriodUpper: periodLabel.toUpperCase(),
    headerTitle: `EMPLOYEE PAY SLIP \u2014 ${periodLabel.toUpperCase()}`,
    grossSalary: formatAmount(profile.grossSalary),
    allowances: formatAmount(profile.allowances),
    bonuses: formatAmount(profile.bonuses),
    overtime: formatAmount(profile.overtime),
    gratuity: formatAmount(profile.gratuity),
    paye: formatAmount(profile.paye),
    nssf: formatAmount(profile.nssf),
    shif: formatAmount(profile.shif),
    housingLevy: formatAmount(profile.housingLevy),
    pension: formatAmount(profile.pension),
    otherDeductions: formatAmount(profile.otherDeductions),
    taxablePay: formatAmount(taxablePay),
    preTaxDeductions: preTaxDeductions ? `(${formatAmount(preTaxDeductions)})` : '\u2014',
    personalRelief: profile.personalRelief ? `(${formatAmount(profile.personalRelief)})` : '\u2014',
    insuranceRelief: profile.insuranceRelief ? `(${formatAmount(profile.insuranceRelief)})` : '\u2014',
    payePayable: formatAmount(profile.paye),
    totalEarnings: formatAmount(totalEarnings),
    totalDeductions: formatAmount(totalDeductions),
    netPay: formatAmount(netPay),
    employeeSignatureName: employee.fullName,
    authorisedBy: 'Kenya Renewable Energy Association',
    employeeSignDate: '',
    authorisedDate: new Date().toLocaleDateString('en-GB'),
    summary: {
      totalEarnings,
      totalDeductions,
      netPay,
      taxablePay
    }
  };

  (profile.otherContributions || []).slice(0, 5).forEach((entry, index) => {
    values[`contribution${index + 1}Label`] = entry.label || '';
    values[`contribution${index + 1}Amount`] = formatAmount(entry.amount);
  });

  return values;
};

module.exports = {
  DATA_KEYS,
  listTemplateFields,
  buildAutoFieldMap,
  fillTemplate,
  buildPayslipValues
};
