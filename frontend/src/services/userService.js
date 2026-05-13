import api from './api';

export const fetchUsers = async (params = {}) => {
  const { data } = await api.get('/users', { params });
  return data.users;
};

export const fetchUserProfile = async (id) => {
  const { data } = await api.get(`/users/${id}`);
  return data;
};

export const createUser = async (payload) => {
  const { data } = await api.post('/users', payload);
  return data.user;
};

export const updateUser = async (id, payload) => {
  const { data } = await api.put(`/users/${id}`, payload);
  return data.user;
};

export const changeUserPassword = async (id, payload) => {
  const { data } = await api.patch(`/users/${id}/change-password`, payload);
  return data;
};

export const resetUserPassword = async (id, password) => {
  const { data } = await api.patch(`/users/${id}/reset-password`, { password });
  return data;
};

export const softDeleteUser = async (id) => {
  const { data } = await api.delete(`/users/${id}`);
  return data.user;
};
