const { query } = require('../config/db');
const { logAction } = require('../services/auditService');

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const formatFolderLabel = (value) => String(value || '')
  .split(/[_-]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const getEmployees = async () => {
  const result = await query(`
    SELECT
      u.employee_no,
      CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
      u.email,
      u.phone,
      u.role,
      COALESCE(u.role_title, u.role) AS role_title,
      COALESCE(d.name, '') AS department,
      COALESCE(CONCAT(s.first_name, ' ', s.last_name), '') AS supervisor_name,
      u.position_title,
      u.joined_at,
      u.is_active,
      u.is_deleted,
      u.created_at
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN users s ON s.id = u.supervisor_id
    ORDER BY u.created_at DESC
  `);

  return result.rows.map((row) => ({
    employeeNo: row.employee_no,
    employeeName: row.employee_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    roleTitle: row.role === 'admin' ? 'IT Officer' : row.role_title,
    department: row.department === 'Human Resources' ? 'Executive Office' : row.department,
    supervisorName: row.supervisor_name,
    positionTitle: row.position_title,
    joinedAt: formatDate(row.joined_at),
    isActive: row.is_active,
    isDeleted: row.is_deleted,
    createdAt: formatDate(row.created_at)
  }));
};

const getDocuments = async () => {
  const result = await query(`
    SELECT
      d.id,
      d.folder_type,
      d.file_name,
      d.mime_type,
      d.file_size,
      d.created_at,
      owner.employee_no,
      CONCAT(owner.first_name, ' ', owner.last_name) AS employee_name,
      owner.email AS employee_email,
      uploader.employee_no AS uploaded_by_employee_no,
      CONCAT(uploader.first_name, ' ', uploader.last_name) AS uploaded_by_name
    FROM documents d
    INNER JOIN users owner ON owner.id = d.user_id
    LEFT JOIN users uploader ON uploader.id = d.uploaded_by
    ORDER BY d.created_at DESC
  `);

  return result.rows.map((row) => ({
    documentId: row.id,
    category: formatFolderLabel(row.folder_type),
    folderType: row.folder_type,
    employeeNo: row.employee_no,
    employeeName: row.employee_name,
    employeeEmail: row.employee_email,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    uploadedByEmployeeNo: row.uploaded_by_employee_no,
    uploadedByName: row.uploaded_by_name,
    uploadedAt: formatDate(row.created_at)
  }));
};

const getLeaveRequests = async () => {
  const result = await query(`
    SELECT
      lr.id,
      owner.employee_no,
      CONCAT(owner.first_name, ' ', owner.last_name) AS employee_name,
      owner.email AS employee_email,
      COALESCE(dep.name, '') AS department,
      lt.label AS leave_type,
      lr.start_date,
      lr.end_date,
      lr.days_requested,
      lr.status,
      lr.reason,
      lr.supervisor_comment,
      lr.hr_comment,
      lr.ceo_comment,
      COALESCE(CONCAT(supervisor.first_name, ' ', supervisor.last_name), '') AS supervisor_name,
      COALESCE(CONCAT(hr.first_name, ' ', hr.last_name), '') AS hr_name,
      COALESCE(CONCAT(ceo.first_name, ' ', ceo.last_name), '') AS ceo_name,
      lr.created_at,
      lr.updated_at
    FROM leave_requests lr
    INNER JOIN users owner ON owner.id = lr.user_id
    INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
    LEFT JOIN departments dep ON dep.id = owner.department_id
    LEFT JOIN users supervisor ON supervisor.id = lr.supervisor_approver_id
    LEFT JOIN users hr ON hr.id = lr.hr_approver_id
    LEFT JOIN users ceo ON ceo.id = lr.ceo_approver_id
    ORDER BY lr.created_at DESC
  `);

  return result.rows.map((row) => ({
    requestId: row.id,
    employeeNo: row.employee_no,
    employeeName: row.employee_name,
    employeeEmail: row.employee_email,
    department: row.department === 'Human Resources' ? 'Executive Office' : row.department,
    leaveType: row.leave_type,
    startDate: formatDate(row.start_date),
    endDate: formatDate(row.end_date),
    daysApplied: Number(row.days_requested || 0),
    status: row.status,
    approved: row.status === 'approved' ? 'Yes' : 'No',
    reason: row.reason,
    supervisorName: row.supervisor_name,
    supervisorComment: row.supervisor_comment,
    hrName: row.hr_name,
    hrComment: row.hr_comment,
    ceoName: row.ceo_name,
    ceoComment: row.ceo_comment,
    appliedAt: formatDate(row.created_at),
    lastUpdatedAt: formatDate(row.updated_at)
  }));
};

const getExportPayload = async (dataset) => {
  if (dataset === 'documents') return { Documents: await getDocuments() };
  if (dataset === 'leaves') return { LeaveRequests: await getLeaveRequests() };
  if (dataset === 'employees') return { Employees: await getEmployees() };

  return {
    Employees: await getEmployees(),
    Documents: await getDocuments(),
    LeaveRequests: await getLeaveRequests()
  };
};

const flattenPayload = (payload) => Object.entries(payload).flatMap(([sheetName, rows]) => rows.map((row) => ({ section: sheetName, ...row })));

const getColumns = (rows) => Array.from(rows.reduce((set, row) => {
  Object.keys(row).forEach((key) => set.add(key));
  return set;
}, new Set()));

const buildJson = (payload) => Buffer.from(JSON.stringify(payload, null, 2));

const buildCsv = (payload) => {
  const rows = flattenPayload(payload);
  const columns = getColumns(rows);
  return Buffer.from([
    columns.map(escapeCsv).join(','),
    ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(','))
  ].join('\n'));
};

const buildExcel = (payload) => {
  const sheets = Object.entries(payload).map(([sheetName, rows]) => {
    const columns = getColumns(rows);
    const header = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('');
    const body = rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join('')}</tr>`).join('');
    return `<h2>${escapeHtml(sheetName)}</h2><table border="1"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
  }).join('<br/>');

  return Buffer.from(`<!doctype html><html><head><meta charset="utf-8" /></head><body>${sheets}</body></html>`);
};

const escapePdfText = (value) => String(value ?? '').replace(/[\\()]/g, '\\$&');

const buildPdf = (payload) => {
  const rows = flattenPayload(payload);
  const lines = ['KEREA HRMS Data Export', `Generated: ${new Date().toISOString()}`, ''];
  rows.slice(0, 300).forEach((row) => {
    const line = Object.entries(row).map(([key, value]) => `${key}: ${value ?? ''}`).join(' | ');
    for (let index = 0; index < line.length; index += 110) {
      lines.push(line.slice(index, index + 110));
    }
    lines.push('');
  });
  if (rows.length > 300) {
    lines.push(`Export truncated in PDF preview to 300 rows. Use JSON or Excel for all ${rows.length} rows.`);
  }

  const text = lines.map((line) => `(${escapePdfText(line)}) Tj T*`).join('\n');
  const stream = `BT /F1 9 Tf 40 790 Td 11 TL\n${text}\nET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
};

const formatConfig = {
  json: { contentType: 'application/json', extension: 'json', build: buildJson },
  csv: { contentType: 'text/csv', extension: 'csv', build: buildCsv },
  excel: { contentType: 'application/vnd.ms-excel', extension: 'xls', build: buildExcel },
  pdf: { contentType: 'application/pdf', extension: 'pdf', build: buildPdf }
};

const exportData = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the IT Officer can export system data.' });
    }

    const dataset = ['all', 'documents', 'leaves', 'employees'].includes(req.params.dataset) ? req.params.dataset : 'all';
    const format = formatConfig[req.query.format] ? req.query.format : 'json';
    const payload = await getExportPayload(dataset);
    const config = formatConfig[format];
    const fileName = `kerea-hrms-${dataset}-export-${new Date().toISOString().slice(0, 10)}.${config.extension}`;

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'DATA_EXPORT',
      entityType: 'system_export',
      entityId: dataset,
      description: `${req.user.fullName} exported ${dataset} data as ${format}.`,
      metadata: { dataset, format },
      ipAddress: req.ip
    });

    res.setHeader('Content-Type', config.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(config.build(payload));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  exportData
};
