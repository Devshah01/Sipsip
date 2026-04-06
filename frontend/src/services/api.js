import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sipsip_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle expired token globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect if user had a token (expired session).
      // Guests (no token) get a silent rejection — no redirect.
      const hadToken = localStorage.getItem('sipsip_token');
      localStorage.removeItem('sipsip_token');
      localStorage.removeItem('sipsip_user');
      if (hadToken) window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);

export default api;