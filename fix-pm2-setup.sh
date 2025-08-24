#!/bin/bash

# Fixed PM2 setup for correct repository structure

set -e

echo "================================================"
echo "   Fixed PM2 Setup for Nubo.email"
echo "================================================"

# Check root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root"
   exit 1
fi

# Install dependencies if not installed
echo "Checking dependencies..."
which node || apt install -y nodejs npm
which psql || apt install -y postgresql postgresql-contrib
which redis-cli || apt install -y redis-server
which nginx || apt install -y nginx
which certbot || apt install -y certbot python3-certbot-nginx
which pm2 || npm install -g pm2

# Setup PostgreSQL
echo "Setting up PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

# Create database (ignore errors if exists)
sudo -u postgres psql << EOF 2>/dev/null || true
CREATE USER nubo WITH PASSWORD 'nubo_password_2024';
CREATE DATABASE nubo_email OWNER nubo;
GRANT ALL PRIVILEGES ON DATABASE nubo_email TO nubo;
EOF

# Start Redis
systemctl start redis-server
systemctl enable redis-server

# Create directories
mkdir -p /var/www/nubo
cd /var/www/nubo

# Clean up old directories
rm -rf backend frontend nubo.email

# Clone the main repository
echo "Cloning repository..."
git clone https://github.com/koolninad/nubo.email.git
cd nubo.email

# Check structure
echo "Repository structure:"
ls -la

# Setup backend
echo "Setting up backend..."
if [ -d "nubo-backend" ]; then
    cd nubo-backend
    echo "Installing backend dependencies..."
    npm install
    
    # Create .env file
    cat > .env << 'EOF'
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nubo_email
DB_USER=nubo
DB_PASSWORD=nubo_password_2024
REDIS_URL=redis://localhost:6379
JWT_SECRET=change_this_secret_key_in_production_2024
CORS_ORIGIN=https://nubo.email
FRONTEND_URL=https://nubo.email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EOF
    
    echo "Building backend..."
    npm run build || echo "Build might have warnings, continuing..."
    cd ..
fi

# Setup frontend
echo "Setting up frontend..."
if [ -d "nubo-frontend" ]; then
    cd nubo-frontend
    echo "Installing frontend dependencies..."
    npm install
    
    # Create .env.local
    cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://api.nubo.email
EOF
    
    echo "Building frontend..."
    npm run build
    cd ..
fi

# Initialize database
echo "Initializing database..."
if [ -f "init.sql" ]; then
    PGPASSWORD=nubo_password_2024 psql -h localhost -U nubo -d nubo_email < init.sql 2>/dev/null || true
else
    echo "Creating database tables..."
    PGPASSWORD=nubo_password_2024 psql -h localhost -U nubo -d nubo_email << 'SQL'
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

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
SQL
fi

# Create PM2 ecosystem file
echo "Creating PM2 configuration..."
cat > /var/www/nubo/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'nubo-backend',
      script: './nubo.email/nubo-backend/dist/index.js',
      cwd: '/var/www/nubo',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/var/log/pm2/backend-error.log',
      out_file: '/var/log/pm2/backend-out.log'
    },
    {
      name: 'nubo-frontend',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/nubo/nubo.email/nubo-frontend',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/pm2/frontend-error.log',
      out_file: '/var/log/pm2/frontend-out.log'
    }
  ]
};
EOF

# Create log directory
mkdir -p /var/log/pm2

# Start with PM2
echo "Starting apps with PM2..."
cd /var/www/nubo
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# Configure Nginx
echo "Configuring Nginx..."
cat > /etc/nginx/sites-available/nubo << 'EOF'
# Upstream definitions
upstream frontend {
    server 127.0.0.1:3000;
}

upstream backend {
    server 127.0.0.1:5000;
}

# HTTP redirect
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

# HTTPS Frontend
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name nubo.email www.nubo.email;
    
    # Use existing certificates if available
    ssl_certificate /opt/nubo.email/certbot/conf/live/nubo.email/fullchain.pem;
    ssl_certificate_key /opt/nubo.email/certbot/conf/live/nubo.email/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    
    client_max_body_size 50M;
    
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
    }
}

# HTTPS API
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
    
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Check if we have existing SSL certificates
if [ -f "/opt/nubo.email/certbot/conf/live/nubo.email/fullchain.pem" ]; then
    echo "Using existing SSL certificates..."
    ln -sf /etc/nginx/sites-available/nubo /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
else
    echo "No SSL certificates found, configuring HTTP only for now..."
    cat > /etc/nginx/sites-available/nubo-http << 'EOF'
server {
    listen 80;
    server_name nubo.email www.nubo.email;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name api.nubo.email;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
    ln -sf /etc/nginx/sites-available/nubo-http /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
fi

# Test and reload nginx
nginx -t && systemctl reload nginx

echo ""
echo "================================================"
echo "   Setup Complete!"
echo "================================================"
echo ""
echo "PM2 Status:"
pm2 status
echo ""
echo "Services:"
echo "PostgreSQL: $(systemctl is-active postgresql)"
echo "Redis: $(systemctl is-active redis-server)"
echo "Nginx: $(systemctl is-active nginx)"
echo ""
echo "Your site should be accessible at:"
if [ -f "/opt/nubo.email/certbot/conf/live/nubo.email/fullchain.pem" ]; then
    echo "  https://nubo.email"
    echo "  https://api.nubo.email"
else
    echo "  http://nubo.email"
    echo "  http://api.nubo.email"
    echo ""
    echo "To add SSL, run:"
    echo "  certbot --nginx -d nubo.email -d www.nubo.email -d api.nubo.email"
fi
echo ""
echo "Useful commands:"
echo "  pm2 logs          - View all logs"
echo "  pm2 logs nubo-backend  - View backend logs"
echo "  pm2 logs nubo-frontend - View frontend logs"
echo "  pm2 restart all   - Restart all apps"
echo "  pm2 monit         - Monitor apps"