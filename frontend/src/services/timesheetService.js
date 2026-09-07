import api from './api';

export const createTimesheet = async (data) => {
  const { data: response } = await api.post('/timesheets', data);
  return response.timesheet;
};

export const getTimesheet = async (id) => {
  const { data: response } = await api.get(`/timesheets/${id}`);
  return response.timesheet;
};

export const updateTimesheet = async (id, data) => {
  const { data: response } = await api.put(`/timesheets/${id}`, data);
  return response.timesheet;
};

export const submitTimesheet = async (id, employeeSignature) => {
  const { data: response } = await api.post(`/timesheets/${id}/submit`, { employeeSignature });
  return response.timesheet;
};

export const approveTimesheet = async (id, supervisorSignature, supervisorComment) => {
  const { data: response } = await api.post(`/timesheets/${id}/approve`, { supervisorSignature, supervisorComment });
  return response.timesheet;
};

export const rejectTimesheet = async (id, supervisorComment) => {
  const { data: response } = await api.post(`/timesheets/${id}/reject`, { supervisorComment });
  return response.timesheet;
};

export const listTimesheets = async (params = {}) => {
  const { data: response } = await api.get('/timesheets', { params });
  return response.timesheets;
};

export const deleteTimesheet = async (id) => {
  const { data: response } = await api.delete(`/timesheets/${id}`);
  return response;
};
