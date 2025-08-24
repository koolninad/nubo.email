#!/bin/bash

# PM2-based deployment for Nubo.email
# No Docker, just Node.js, PM2, PostgreSQL, Redis, and Nginx

set -e

echo "================================================"
echo "   Nubo.email PM2 Deployment"
echo "================================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root"
   exit 1
fi

# Step 1: Clean up Docker (optional)
print_warning "This will remove ALL Docker containers and images!"
read -p "Do you want to clean up Docker? (yes/no): " cleanup_docker
if [ "$cleanup_docker" = "yes" ]; then
    print_status "Cleaning up Docker..."
    docker stop $(docker ps -aq) 2>/dev/null || true
    docker rm $(docker ps -aq) 2>/dev/null || true
    docker system prune -af --volumes
    systemctl stop docker
    systemctl disable docker
fi

# Step 2: Install required software
print_status "Installing required software..."
apt update
apt install -y nodejs npm postgresql postgresql-contrib redis-server nginx python3-certbot-nginx git curl

# Install PM2 globally
npm install -g pm2

# Step 3: Setup PostgreSQL
print_status "Setting up PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE USER nubo WITH PASSWORD 'nubo_password_2024';
CREATE DATABASE nubo_email OWNER nubo;
GRANT ALL PRIVILEGES ON DATABASE nubo_email TO nubo;
EOF

# Step 4: Setup Redis
print_status "Setting up Redis..."
systemctl start redis-server
systemctl enable redis-server

# Step 5: Create application directory
print_status "Creating application directory..."
mkdir -p /var/www/nubo
cd /var/www/nubo

# Step 6: Clone repositories
print_status "Cloning repositories..."
git clone https://github.com/koolninad/nubo.email.git backend
git clone https://github.com/koolninad/nubo-frontend.git frontend

# Step 7: Setup Backend
print_status "Setting up backend..."
cd /var/www/nubo/backend/nubo-backend

# Install dependencies
npm install

# Create .env file
cat > .env << 'EOF'
NODE_ENV=production
PORT=5000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nubo_email
DB_USER=nubo
DB_PASSWORD=nubo_password_2024

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_2024

# CORS
CORS_ORIGIN=https://nubo.email

# SMTP (configure these)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=

# Frontend URL
FRONTEND_URL=https://nubo.email
EOF

# Build TypeScript
print_status "Building backend..."
npm run build

# Initialize database
print_status "Initializing database..."
psql -U nubo -d nubo_email << 'SQL'
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email accounts
CREATE TABLE IF NOT EXISTS email_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    imap_host VARCHAR(255) NOT NULL,
    imap_port INTEGER NOT NULL,
    imap_secure BOOLEAN DEFAULT TRUE,
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INTEGER NOT NULL,
    smtp_secure BOOLEAN DEFAULT TRUE,
    username VARCHAR(255) NOT NULL,
    password_encrypted TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
SQL

# Step 8: Setup Frontend
print_status "Setting up frontend..."
cd /var/www/nubo/frontend

# Install dependencies
npm install

# Create .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://api.nubo.email
EOF

# Build Next.js app
print_status "Building frontend..."
npm run build

# Step 9: Setup PM2
print_status "Setting up PM2..."

# Create PM2 ecosystem file
cat > /var/www/nubo/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'nubo-backend',
      script: '/var/www/nubo/backend/nubo-backend/dist/index.js',
      cwd: '/var/www/nubo/backend/nubo-backend',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/var/log/pm2/nubo-backend-error.log',
      out_file: '/var/log/pm2/nubo-backend-out.log',
      log_file: '/var/log/pm2/nubo-backend-combined.log',
      time: true
    },
    {
      name: 'nubo-frontend',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/nubo/frontend',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/pm2/nubo-frontend-error.log',
      out_file: '/var/log/pm2/nubo-frontend-out.log',
      log_file: '/var/log/pm2/nubo-frontend-combined.log',
      time: true
    }
  ]
};
EOF

# Start PM2 apps
cd /var/www/nubo
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# Step 10: Configure Nginx
print_status "Configuring Nginx..."

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Create Nginx configuration
cat > /etc/nginx/sites-available/nubo << 'EOF'
# Rate limiting
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

# Upstream servers
upstream backend {
    least_conn;
    server 127.0.0.1:5000;
    server 127.0.0.1:5001;
}

upstream frontend {
    server 127.0.0.1:3000;
}

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

    # SSL certificates (will be added by certbot)
    ssl_certificate /etc/letsencrypt/live/nubo.email/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nubo.email/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Rate limiting
    limit_req zone=general burst=20 nodelay;
    
    # Proxy to frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# API Backend - api.nubo.email  
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.nubo.email;

    # SSL certificates (will be added by certbot)
    ssl_certificate /etc/letsencrypt/live/nubo.email/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nubo.email/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Rate limiting for API
    limit_req zone=api burst=50 nodelay;
    
    # Proxy to backend
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/nubo /etc/nginx/sites-enabled/

# Test nginx configuration
nginx -t

# Reload nginx
systemctl reload nginx

# Step 11: Get SSL certificates
print_status "Getting SSL certificates..."
certbot --nginx -d nubo.email -d www.nubo.email -d api.nubo.email --non-interactive --agree-tos --email admin@nubo.email

# Step 12: Setup auto-renewal
print_status "Setting up SSL auto-renewal..."
echo "0 0,12 * * * root python3 -c 'import random; import time; time.sleep(random.random() * 3600)' && certbot renew -q" | tee -a /etc/crontab > /dev/null

# Step 13: Setup log rotation
print_status "Setting up log rotation..."
cat > /etc/logrotate.d/nubo << 'EOF'
/var/log/pm2/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Step 14: Final status check
echo ""
echo "================================================"
echo "   PM2 Deployment Complete!"
echo "================================================"
echo ""
print_status "Services Status:"
echo ""
pm2 status
echo ""
print_status "PostgreSQL: $(systemctl is-active postgresql)"
print_status "Redis: $(systemctl is-active redis-server)"
print_status "Nginx: $(systemctl is-active nginx)"
echo ""
print_status "Your site should be accessible at:"
echo "  https://nubo.email"
echo "  https://api.nubo.email"
echo ""
print_warning "Remember to:"
echo "  1. Configure SMTP settings in /var/www/nubo/backend/nubo-backend/.env"
echo "  2. Update JWT_SECRET in production"
echo "  3. Change database password from default"
echo ""
print_status "Useful commands:"
echo "  pm2 status          - Check app status"
echo "  pm2 logs            - View logs"
echo "  pm2 restart all     - Restart all apps"
echo "  pm2 monit           - Monitor apps"
echo "  systemctl status nginx/postgresql/redis-server"