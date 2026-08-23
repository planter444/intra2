import api from './api';

export const fetchAuditLogs = async (limit = 100) => {
  const { data } = await api.get('/audit-logs', { params: { limit } });
  return data.logs;
};
