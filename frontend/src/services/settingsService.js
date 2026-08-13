import api from './api';

export const fetchSettings = async () => {
  const { data } = await api.get('/settings');
  return data.settings;
};

export const updateSettings = async (payload) => {
  const { data } = await api.patch('/settings', payload);
  return data.settings;
};

export const restoreSettings = async () => {
  const { data } = await api.post('/settings/restore');
  return data.settings;
};
