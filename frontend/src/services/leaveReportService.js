import api from './api';

export const getLeaveReportData = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.employeeId) params.append('employeeId', filters.employeeId);
  if (filters.departmentId) params.append('departmentId', filters.departmentId);
  if (filters.leaveTypeId) params.append('leaveTypeId', filters.leaveTypeId);
  if (filters.status) params.append('status', filters.status);

  const response = await api.get(`/leave-report/data?${params.toString()}`);
  return response.data;
};

export const getLeaveReportFilters = async () => {
  const response = await api.get('/leave-report/filters');
  return response.data;
};
