import api from './api';

export const loginRequest = async (credentials) => {
  const { data } = await api.post('/auth/login', credentials);
  return data;
};

export const forgotPasswordRequest = async (payload) => {
  const { data } = await api.post('/auth/forgot-password', payload);
  return data;
};

export const meRequest = async () => {
  const { data } = await api.get('/auth/me');
  return data;
};

export const resetPasswordRequest = async (payload) => {
  const { data } = await api.post('/auth/reset-password', payload);
  return data;
};
