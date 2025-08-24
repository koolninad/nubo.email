import axios from 'axios';

// Dynamically determine API URL based on current domain
const getApiUrl = () => {
  if (typeof window === 'undefined') {
    // Server-side: use environment variable or default
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
  }
  
  // Client-side: determine based on current domain
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // Production domains
  if (hostname === 'nubo.email' || hostname === 'www.nubo.email') {
    return 'https://api.nubo.email';
  }
  
  // Development
  if (hostname === 'localhost') {
    return 'http://localhost:5001';
  }
  
  // For any other domain (custom domains, staging, etc)
  // Assume API is on api.{domain}
  return `${protocol}//api.${hostname}`;
};

// Create axios instance without baseURL initially
const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to set the base URL dynamically
api.interceptors.request.use((config) => {
  const apiUrl = getApiUrl();
  config.baseURL = apiUrl;
  return config;
});

// Helper function to get auth token from either localStorage or sessionStorage
const getAuthToken = () => {
  // First check if remember me is enabled and token hasn't expired
  const rememberMe = localStorage.getItem('rememberMe') === 'true';
  const loginExpiry = localStorage.getItem('loginExpiry');
  
  if (rememberMe && loginExpiry && Date.now() < parseInt(loginExpiry)) {
    return localStorage.getItem('token');
  }
  
  // Otherwise check sessionStorage
  return sessionStorage.getItem('token') || localStorage.getItem('token');
};

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear all auth data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('rememberMe');
      localStorage.removeItem('loginExpiry');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  signup: (username: string, email: string, password: string) =>
    api.post('/auth/signup', { username, email, password }),
};

export const emailAccountsApi = {
  getAll: () => api.get('/email-accounts'),
  add: (data: any) => api.post('/email-accounts', data),
  update: (id: number, data: any) => api.put(`/email-accounts/${id}`, data),
  delete: (id: number) => api.delete(`/email-accounts/${id}`),
  testConnection: (data: any) => api.post('/email-accounts/test', data),
};

export const mailApi = {
  getInbox: (params?: { account_id?: number; limit?: number; offset?: number }) =>
    api.get('/mail/inbox', { params }),
  getEmailBody: (emailId: number) => api.get(`/mail/email/${emailId}/body`),
  sync: (accountId: number) => api.post(`/mail/sync/${accountId}`),
  send: (data: any) => api.post('/mail/send', data),
  update: (emailId: number, data: any) => api.patch(`/mail/${emailId}`, data),
};

export default api;