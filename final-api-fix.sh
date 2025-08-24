#!/bin/bash

# Final fix for API URLs - remove double /api

echo "================================================"
echo "   Final API URL Fix"
echo "================================================"

cd /var/www/nubo

# Fix 1: Update frontend environment variable (remove /api suffix)
echo "Updating frontend environment..."
cd nubo-frontend
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://api.nubo.email
EOF

# Fix 2: Update lib/api.ts to add /api properly
echo "Updating lib/api.ts..."
cat > lib/api.ts << 'EOF'
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

// Add request interceptor to set the base URL dynamically and add /api prefix
api.interceptors.request.use((config) => {
  const apiUrl = getApiUrl();
  // Add /api prefix to all requests
  config.baseURL = apiUrl + '/api';
  
  // Get auth token
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
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

# Fix 3: Update signup page to remove extra /api
echo "Updating signup page..."
sed -i "s|await api.get(\`/api/auth/check-username/\${username}\`)|await api.get(\`/auth/check-username/\${username}\`)|g" app/\(auth\)/signup/page.tsx

# Fix 4: Update nginx to strip /api from backend calls
echo "Updating nginx configuration..."
cat > /etc/nginx/sites-available/nubo << 'EOF'
# Rate limiting
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

# HTTP redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name nubo.email www.nubo.email api.nubo.email;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Frontend - nubo.email
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name nubo.email www.nubo.email;

    ssl_certificate /opt/nubo.email/certbot/conf/live/nubo.email/fullchain.pem;
    ssl_certificate_key /opt/nubo.email/certbot/conf/live/nubo.email/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000" always;
    
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}

# API Backend - api.nubo.email
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.nubo.email;

    ssl_certificate /opt/nubo.email/certbot/conf/live/nubo.email/fullchain.pem;
    ssl_certificate_key /opt/nubo.email/certbot/conf/live/nubo.email/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000" always;
    
    # Rate limiting
    limit_req zone=api burst=50 nodelay;
    
    client_max_body_size 50M;

    # Proxy to backend - backend expects /api prefix
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Rebuild frontend
echo "Rebuilding frontend..."
cd /var/www/nubo/nubo-frontend
npm run build

# Restart services
echo "Restarting services..."
pm2 restart nubo-frontend
nginx -t && systemctl reload nginx

echo "Waiting for services..."
sleep 10

# Test the API
echo ""
echo "Testing API endpoints..."
echo -n "Health check: "
curl -s https://api.nubo.email/api/health | head -c 50
echo ""
echo -n "Auth endpoint: "
curl -s -X POST https://api.nubo.email/api/auth/login -H "Content-Type: application/json" -d '{"username":"test","password":"test"}' | head -c 100
echo ""

echo ""
echo "================================================"
echo "   API URLs Fixed!"
echo "================================================"
echo ""
echo "The API should now work correctly:"
echo "  • Login: https://api.nubo.email/api/auth/login"
echo "  • Signup: https://api.nubo.email/api/auth/signup"
echo "  • Username check: https://api.nubo.email/api/auth/check-username/:username"
echo ""
echo "Try creating an account at https://nubo.email/signup"