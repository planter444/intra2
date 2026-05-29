import api from './api';

export const generatePayslipPdf = async (employeeId, month) => {
  const response = await api.get(`/payslips/generate/${employeeId}`, {
    params: { month },
    responseType: 'blob'
  });
  return response.data;
};
