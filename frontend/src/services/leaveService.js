import api from './api';

const notifyLeaveUpdates = () => window.dispatchEvent(new Event('leave-requests-updated'));

const buildFormData = (payload) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    formData.append(key, value);
  });

  return formData;
};

export const fetchLeaveTypes = async () => {
  const { data } = await api.get('/leaves/types');
  return data.leaveTypes;
};

export const fetchLeaveBalances = async (params = {}) => {
  const { data } = await api.get('/leaves/balances', { params });
  return data.balances;
};

export const fetchLeaveRequests = async (params = {}) => {
  const { data } = await api.get('/leaves/requests', { params });
  return data.requests;
};

export const fetchLeaveOverview = async (params = {}) => {
  const { data } = await api.get('/leaves/overview', { params });
  return data;
};

export const fetchLeaveRequest = async (id) => {
  const { data } = await api.get(`/leaves/requests/${id}`);
  return data.request;
};

export const createLeaveRequest = async (payload) => {
  const formData = buildFormData(payload);
  const { data } = await api.post('/leaves/requests', formData);
  notifyLeaveUpdates();
  return data.request;
};

export const updateLeaveRequest = async (id, payload) => {
  const formData = buildFormData(payload);
  const { data } = await api.put(`/leaves/requests/${id}`, formData);
  notifyLeaveUpdates();
  return data.request;
};

export const cancelLeaveRequest = async (id) => {
  const { data } = await api.patch(`/leaves/requests/${id}/cancel`);
  notifyLeaveUpdates();
  return data.request;
};

export const downloadLeaveSupportingDocument = async (id) => {
  const response = await api.get(`/leaves/requests/${id}/supporting-document`, { responseType: 'blob' });
  const disposition = response.headers['content-disposition'] || '';
  const filenameMatch = disposition.match(/filename="?([^\"]+)"?/i);
  const filename = filenameMatch?.[1] || 'supporting-document';
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const decideLeaveRequest = async (id, payload) => {
  const { data } = await api.patch(`/leaves/requests/${id}/decision`, payload);
  notifyLeaveUpdates();
  return data.request;
};

export const deleteLeaveRequest = async (id) => {
  const { data } = await api.delete(`/leaves/requests/${id}`);
  notifyLeaveUpdates();
  return data?.success === true;
};
