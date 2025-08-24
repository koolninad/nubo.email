#!/bin/bash

# Simple fix for API URL issues - no more complexity, just direct fixes

echo "================================================"
echo "   API URL Fix - Simple & Direct"
echo "================================================"

cd /var/www/nubo

# First, pull latest changes
echo "Pulling latest changes..."
git pull origin main

# Fix 1: Update frontend lib/api.ts to correctly handle API URLs
echo "Fixing lib/api.ts..."
cat > nubo-frontend/lib/api.ts << 'EOF'
import axios from 'axios';

// Dynamically determine API URL based on current domain
const getApiUrl = () => {
  if (typeof window === 'undefined') {
    // Server-side: use environment variable or default
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
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
    return 'http://localhost:5000';
  }
  
  // For any other domain (custom domains, staging, etc)
  // Assume API is on api.{domain}
  return `${protocol}//api.${hostname}`;
};

// Create axios instance
const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
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

// Add request interceptor to set the base URL dynamically and add authentication
api.interceptors.request.use((config) => {
  const apiUrl = getApiUrl();
  // Add /api prefix to all requests
  config.baseURL = apiUrl + '/api';
  
  // Add authentication token if available
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
EOF

# Fix 2: Update signup page to use correct API path
echo "Fixing signup page..."
sed -i "s|await api.get(\`/api/auth/check-username/\${username}\`)|await api.get(\`/auth/check-username/\${username}\`)|g" nubo-frontend/app/\(auth\)/signup/page.tsx

# Fix 3: Update environment variable (remove /api suffix)
echo "Updating environment variable..."
cat > nubo-frontend/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://api.nubo.email
EOF

# Fix 4: Rebuild backend with correct imports
echo "Rebuilding backend..."
cd nubo-backend
npm run build

# Fix 5: Rebuild frontend
echo "Rebuilding frontend..."
cd ../nubo-frontend
npm run build

# Restart PM2 services
echo "Restarting PM2 services..."
pm2 restart all

echo "Waiting for services to start..."
sleep 10

# Test the API
echo ""
echo "Testing API endpoints..."
echo "========================"

echo -n "1. Health check: "
curl -s -w "\n   Status: %{http_code}\n" https://api.nubo.email/api/health

echo -n "2. Auth login endpoint: "
curl -s -X POST https://api.nubo.email/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' \
  -w "\n   Status: %{http_code}\n" | head -c 100

echo ""
echo -n "3. Username check endpoint: "
curl -s -w "\n   Status: %{http_code}\n" https://api.nubo.email/api/auth/check-username/testuser

echo ""
echo "================================================"
echo "   Fix Applied!"
echo "================================================"
echo ""
echo "API endpoints should now work correctly:"
echo "  • https://api.nubo.email/api/auth/login"
echo "  • https://api.nubo.email/api/auth/signup"
echo "  • https://api.nubo.email/api/auth/check-username/:username"
echo ""
echo "Try creating an account at https://nubo.email/signup"