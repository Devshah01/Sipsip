import api from './api';

export const getCurrentUser = async () => {
  const res = await api.get('/auth/me');
  return res.data;
};

export const registerUser = async (name, email, password) => {
  const res = await api.post('/auth/register', { name, email, password });
  return res.data;
};

export const loginUser = async (email, password) => {
  const res = await api.post('/auth/login', { email, password });
  return res.data;
};

export const logoutUser = async () => {
  const res = await api.post('/auth/logout');
  return res.data;
};

export const forgotPassword = async (email) => {
  const res = await api.post('/auth/forgot-password', { email });
  return res.data;
};

export const resetPasswordWithToken = async (token, password) => {
  const res = await api.post('/auth/reset-password', { token, password });
  return res.data;
};
