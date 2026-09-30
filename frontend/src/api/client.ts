import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('medflow_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('medflow_token');
      localStorage.removeItem('medflow_user');
      window.location.href = '/login';
    } else {
      console.error('API Error:', error.response?.data?.message || error.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
