import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const getTravelReportFilters = async () => {
  const token = localStorage.getItem('kerea_hrms_auth') ? JSON.parse(localStorage.getItem('kerea_hrms_auth')).token : null;
  const response = await axios.get(`${API_URL}/travel-report/filters`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getTravelReportData = async (filters) => {
  const token = localStorage.getItem('kerea_hrms_auth') ? JSON.parse(localStorage.getItem('kerea_hrms_auth')).token : null;
  const params = new URLSearchParams();
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.employeeId) params.append('employeeId', filters.employeeId);
  if (filters.departmentId) params.append('departmentId', filters.departmentId);
  if (filters.travelCategory) params.append('travelCategory', filters.travelCategory);
  if (filters.status) params.append('status', filters.status);

  const response = await axios.get(`${API_URL}/travel-report/data?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};
