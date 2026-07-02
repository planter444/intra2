import api from './api';

export const fetchPayslips = async (params = {}) => {
  const { data } = await api.get('/payslips', { params });
  return data.payslips;
};

export const generatePayslips = async (payload) => {
  const { data } = await api.post('/payslips/generate', payload);
  return data;
};

export const downloadPayslipBlob = async (payslipId) => {
  const response = await api.get(`/payslips/${payslipId}/file`, { responseType: 'blob' });
  return response.data;
};

export const fetchPayrollProfile = async (userId) => {
  const { data } = await api.get(`/payslips/profile/${userId}`);
  return data.profile;
};

export const savePayrollProfile = async (userId, profile) => {
  const { data } = await api.put(`/payslips/profile/${userId}`, profile);
  return data.profile;
};

export const fetchTemplates = async () => {
  const { data } = await api.get('/payslips/templates');
  return data.templates;
};

export const uploadTemplate = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/payslips/templates', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
};

export const fetchTemplateFields = async (templateId) => {
  const { data } = await api.get(`/payslips/templates/${templateId}/fields`);
  return data;
};

export const activateTemplate = async (templateId) => {
  const { data } = await api.patch(`/payslips/templates/${templateId}/activate`);
  return data.template;
};

export const saveTemplateMapping = async (templateId, fieldMap) => {
  const { data } = await api.patch(`/payslips/templates/${templateId}/mapping`, { fieldMap });
  return data.template;
};

export const downloadTemplateBlob = async (templateId) => {
  const response = await api.get(`/payslips/templates/${templateId}/file`, { responseType: 'blob' });
  return response.data;
};
