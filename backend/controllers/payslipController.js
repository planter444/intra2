const userModel = require('../models/userModel');
const payslipModel = require('../models/payslipModel');
const {
  DATA_KEYS,
  listTemplateFields,
  buildAutoFieldMap,
  fillTemplate,
  buildPayslipValues
} = require('../services/payslipPdfService');
const { generateSystemPayslip } = require('../services/payslipDesignService');
const settingsModel = require('../models/settingsModel');

const getPayslipHeader = async () => {
  const settings = await settingsModel.getGlobal();
  const branding = settings?.payload?.branding || {};
  return {
    organizationName: branding.payslipOrganizationName || undefined,
    addressLine: branding.payslipAddressLine || undefined,
    authorisedByName: branding.payslipOrganizationName || undefined
  };
};

const PRIVILEGED_ROLES = ['admin', 'ceo', 'finance'];

const isPrivileged = (user) => PRIVILEGED_ROLES.includes(user.role);

const listTemplates = async (req, res, next) => {
  try {
    const templates = await payslipModel.listTemplates();
    res.json({ templates });
  } catch (error) {
    next(error);
  }
};

const uploadTemplate = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'A PDF template file is required.' });
    }
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ message: 'The template must be a PDF file.' });
    }

    let fields;
    try {
      fields = await listTemplateFields(req.file.buffer);
    } catch (error) {
      return res.status(400).json({ message: 'Unable to read this PDF. Please upload a valid PDF file.' });
    }

    if (!fields.length) {
      return res.status(400).json({
        message: 'This PDF has no fillable form fields. Please upload the official template with form fields so values can be filled without changing the design.'
      });
    }

    const fieldMap = buildAutoFieldMap(fields.map((field) => field.name));
    const template = await payslipModel.createTemplate({
      fileName: req.file.originalname,
      fileData: req.file.buffer,
      fieldMap,
      uploadedBy: req.user.id
    });

    res.status(201).json({ template, fields });
  } catch (error) {
    next(error);
  }
};

const getTemplateFields = async (req, res, next) => {
  try {
    const template = await payslipModel.getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: 'Template not found.' });
    }
    const fields = await listTemplateFields(template.fileData);
    res.json({ fields, fieldMap: template.fieldMap, dataKeys: DATA_KEYS });
  } catch (error) {
    next(error);
  }
};

const activateTemplate = async (req, res, next) => {
  try {
    const template = await payslipModel.activateTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ message: 'Template not found.' });
    }
    res.json({ template });
  } catch (error) {
    next(error);
  }
};

const deactivateTemplate = async (req, res, next) => {
  try {
    const template = await payslipModel.deactivateTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ message: 'Template not found.' });
    }
    res.json({ template });
  } catch (error) {
    next(error);
  }
};

const deleteTemplate = async (req, res, next) => {
  try {
    const deleted = await payslipModel.deleteTemplate(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Template not found.' });
    }
    res.json({ message: 'Template deleted.' });
  } catch (error) {
    next(error);
  }
};

const updateTemplateMapping = async (req, res, next) => {
  try {
    const template = await payslipModel.updateTemplateFieldMap(req.params.id, req.body.fieldMap || {});
    if (!template) {
      return res.status(404).json({ message: 'Template not found.' });
    }
    res.json({ template });
  } catch (error) {
    next(error);
  }
};

const downloadTemplateFile = async (req, res, next) => {
  try {
    const template = await payslipModel.getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: 'Template not found.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${template.fileName}"`);
    res.send(template.fileData);
  } catch (error) {
    next(error);
  }
};

const getDataKeys = (req, res) => {
  res.json({ dataKeys: DATA_KEYS });
};

const getPayrollProfile = async (req, res, next) => {
  try {
    const profile = await payslipModel.getProfileByUserId(req.params.userId);
    res.json({ profile: profile || null });
  } catch (error) {
    next(error);
  }
};

const savePayrollProfile = async (req, res, next) => {
  try {
    const profile = await payslipModel.upsertProfile(req.params.userId, req.body || {});
    res.json({ profile });
  } catch (error) {
    next(error);
  }
};

const generateForEmployee = async ({ userId, period, template, generatedBy }) => {
  const employee = await userModel.findById(userId);
  if (!employee || employee.isDeleted || !employee.isActive) {
    return { userId, error: 'Employee not found or inactive.' };
  }

  const profile = await payslipModel.getProfileByUserId(userId);
  if (!profile) {
    return { userId, name: employee.fullName, error: 'No payroll profile set for this employee.' };
  }

  const values = buildPayslipValues({ employee, profile, period });
  const { summary, ...fillValues } = values;
  const pdfData = template
    ? await fillTemplate(template.fileData, template.fieldMap, fillValues)
    : await generateSystemPayslip({ employee, profile, period, values: fillValues, header: await getPayslipHeader() });

  const payslip = await payslipModel.upsertPayslip({
    userId,
    period,
    templateId: template ? template.id : null,
    data: { ...fillValues, summary },
    pdfData,
    generatedBy
  });

  return { userId, name: employee.fullName, payslipId: payslip.id };
};

const generatePayslips = async (req, res, next) => {
  try {
    const { userId, period, all } = req.body || {};
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ message: 'A payroll period is required (format: YYYY-MM).' });
    }

    const template = await payslipModel.getActiveTemplate();
    if (template && !Object.keys(template.fieldMap || {}).length) {
      return res.status(400).json({ message: 'The active template has no field mapping configured yet. Map its fields or deactivate it to use the system-generated design.' });
    }

    let targets = [];
    if (all) {
      const users = await userModel.listAll({});
      targets = users.filter((user) => user.isActive && !user.isDeleted).map((user) => user.id);
    } else if (userId) {
      targets = [userId];
    } else {
      return res.status(400).json({ message: 'Provide a userId or set all=true.' });
    }

    const results = [];
    for (const targetId of targets) {
      results.push(await generateForEmployee({ userId: targetId, period, template, generatedBy: req.user.id }));
    }

    const generated = results.filter((result) => result.payslipId);
    const failed = results.filter((result) => result.error);
    res.json({ generated, failed });
  } catch (error) {
    next(error);
  }
};

const previewPayslip = async (req, res, next) => {
  try {
    const { userId, period } = req.body || {};
    if (!userId || !period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ message: 'A userId and period (YYYY-MM) are required.' });
    }

    const template = await payslipModel.getActiveTemplate();

    const employee = await userModel.findById(userId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    const profile = await payslipModel.getProfileByUserId(userId);
    if (!profile) {
      return res.status(400).json({ message: 'No payroll profile set for this employee. Save payroll details first.' });
    }

    const values = buildPayslipValues({ employee, profile, period });
    const { summary, ...fillValues } = values;
    const pdfData = template
      ? await fillTemplate(template.fileData, template.fieldMap, fillValues, { flatten: false })
      : await generateSystemPayslip({ employee, profile, period, values: fillValues, header: await getPayslipHeader() });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="payslip_preview_${period}.pdf"`);
    res.send(pdfData);
  } catch (error) {
    next(error);
  }
};

const deletePayslip = async (req, res, next) => {
  try {
    const deleted = await payslipModel.deletePayslip(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Payslip not found.' });
    }
    res.json({ message: 'Payslip deleted.' });
  } catch (error) {
    next(error);
  }
};

const listMyOrAllPayslips = async (req, res, next) => {
  try {
    const { period, userId } = req.query;
    const filters = { period: period || undefined };

    if (isPrivileged(req.user)) {
      if (userId) {
        filters.userId = userId;
      }
    } else {
      filters.userId = req.user.id;
    }

    const payslips = await payslipModel.listPayslips(filters);
    res.json({ payslips });
  } catch (error) {
    next(error);
  }
};

const downloadPayslipFile = async (req, res, next) => {
  try {
    const payslip = await payslipModel.getPayslipById(req.params.id);
    if (!payslip) {
      return res.status(404).json({ message: 'Payslip not found.' });
    }

    if (!isPrivileged(req.user) && String(payslip.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'You can only access your own payslips.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="payslip_${payslip.employeeNo || payslip.userId}_${payslip.period}.pdf"`);
    res.send(payslip.pdfData);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listTemplates,
  uploadTemplate,
  getTemplateFields,
  activateTemplate,
  deactivateTemplate,
  deleteTemplate,
  updateTemplateMapping,
  downloadTemplateFile,
  getDataKeys,
  getPayrollProfile,
  savePayrollProfile,
  generatePayslips,
  previewPayslip,
  deletePayslip,
  listMyOrAllPayslips,
  downloadPayslipFile
};
