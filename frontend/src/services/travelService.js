import api from './api';

export const fetchTravelRequests = async (params = {}) => {
  const response = await api.get('/travel/requests', { params });
  return response.data.requests;
};

export const fetchTravelRequest = async (id) => {
  const response = await api.get(`/travel/requests/${id}`);
  return response.data.request;
};

export const createTravelRequest = async (data) => {
  const response = await api.post('/travel/requests', data);
  return response.data.request;
};

export const updateTravelRequest = async (id, data) => {
  const response = await api.put(`/travel/requests/${id}`, data);
  return response.data.request;
};

export const cancelTravelRequest = async (id) => {
  await api.patch(`/travel/requests/${id}/cancel`);
  return null;
};

export const decideTravelRequest = async (id, decision, comment) => {
  const response = await api.patch(`/travel/requests/${id}/decision`, { decision, comment });
  return response.data.request;
};

export const deleteTravelRequest = async (id) => {
  await api.delete(`/travel/requests/${id}`);
  return true;
};

export const fetchTravelReceipts = async (params = {}) => {
  const response = await api.get('/travel/receipts', { params });
  return response.data.receipts;
};

export const fetchTravelReceipt = async (id) => {
  const response = await api.get(`/travel/receipts/${id}`);
  return response.data.receipt;
};

export const uploadTravelReceipt = async (data) => {
  const formData = new FormData();
  Object.keys(data).forEach((key) => {
    if (data[key] !== null && data[key] !== undefined) {
      formData.append(key, data[key]);
    }
  });
  const response = await api.post('/travel/receipts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data.receipt;
};

export const updateTravelReceiptStatus = async (id, reimbursementStatus, reviewComment) => {
  const response = await api.patch(`/travel/receipts/${id}/status`, { reimbursementStatus, reviewComment });
  return response.data.receipt;
};

export const deleteTravelReceipt = async (id) => {
  await api.delete(`/travel/receipts/${id}`);
  return true;
};

export const downloadTravelReceipt = async (id, preview = false) => {
  const response = await api.get(`/travel/receipts/${id}/download`, {
    params: { preview },
    responseType: 'blob'
  });
  return response.data;
};

export const fetchTravelNotificationSettings = async () => {
  const response = await api.get('/travel/notification-settings');
  return response.data.settings;
};

export const updateTravelNotificationSettings = async (data) => {
  const response = await api.put('/travel/notification-settings', data);
  return response.data.settings;
};

export const fetchTravelRoutingSettings = async () => {
  const response = await api.get('/travel/routing-settings');
  return response.data.settings;
};

export const updateTravelRoutingSettings = async (data) => {
  const response = await api.put('/travel/routing-settings', data);
  return response.data.settings;
};

export const fetchAllEmployeeRouting = async () => {
  const response = await api.get('/travel/employee-routing');
  return response.data.routing;
};

export const getApproverForEmployee = async (employeeId) => {
  const response = await api.get(`/travel/employee-routing/employee/${employeeId}`);
  return response.data.approver;
};

export const addEmployeeRouting = async (data) => {
  const response = await api.post('/travel/employee-routing', data);
  return response.data.routing;
};

export const removeEmployeeRouting = async (id) => {
  const response = await api.delete(`/travel/employee-routing/${id}`);
  return response.data;
};

export const getPendingTravelRequestCount = async () => {
  const response = await api.get('/travel/pending-count');
  return response.data.count;
};
