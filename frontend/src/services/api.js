import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = String(error.config?.url || '');
    if ([401, 403].includes(status) && !url.includes('/auth/login')) {
      window.dispatchEvent(new CustomEvent('auth-session-expired', {
        detail: {
          message: status === 401
            ? 'Your session has expired. Please refresh the page or log in again.'
            : 'Your session no longer has permission for this action. Please log out and log in again.'
        }
      }));
    }
    return Promise.reject(error);
  }
);

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export default api;
