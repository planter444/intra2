import api from './api';

export const fetchDashboardSummary = async () => {
  const { data } = await api.get('/dashboard/summary');
  return data.summary;
};
