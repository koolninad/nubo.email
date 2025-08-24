#!/bin/bash

# Quick PM2 setup for Nubo.email
# Assumes you already have the code and just need to set up services

set -e

echo "================================================"
echo "   Quick PM2 Setup for Nubo.email"
echo "================================================"

# Check root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root"
   exit 1
fi

# Install dependencies
echo "Installing dependencies..."
apt update
apt install -y nodejs npm postgresql redis-server nginx certbot python3-certbot-nginx
npm install -g pm2

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

# Get code from GitHub
echo "Getting code..."
rm -rf backend frontend
git clone https://github.com/koolninad/nubo.email.git backend
git clone https://github.com/koolninad/nubo-frontend.git frontend 2>/dev/null || echo "Frontend repo might not exist separately"

# If frontend doesn't exist separately, it might be in the main repo
if [ ! -d "frontend" ]; then
    cp -r backend/nubo-frontend frontend 2>/dev/null || true
fi

# Setup backend
echo "Setting up backend..."
cd /var/www/nubo/backend
if [ -d "nubo-backend" ]; then
    cd nubo-backend
fi

npm install
npm run build || echo "Build might fail, continuing..."

# Create backend .env
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
EOF

# Setup frontend
echo "Setting up frontend..."
cd /var/www/nubo/frontend
npm install
npm run build

# Create PM2 config
cat > /var/www/nubo/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'nubo-backend',
      script: 'dist/index.js',
      cwd: '/var/www/nubo/backend/nubo-backend',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'nubo-frontend',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/nubo/frontend',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
EOF

# Start with PM2
echo "Starting apps with PM2..."
cd /var/www/nubo
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# Setup Nginx (basic config)
cat > /etc/nginx/sites-available/nubo << 'EOF'
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

ln -sf /etc/nginx/sites-available/nubo /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Get SSL certificates
echo "Getting SSL certificates..."
certbot --nginx -d nubo.email -d www.nubo.email -d api.nubo.email --non-interactive --agree-tos --email admin@nubo.email --redirect

# Initialize database
echo "Initializing database..."
cd /var/www/nubo/backend
if [ -d "nubo-backend" ]; then
    cd nubo-backend
fi

# Check if init.sql exists
if [ -f "../init.sql" ]; then
    sudo -u postgres psql -d nubo_email < ../init.sql
elif [ -f "../../init.sql" ]; then  
    sudo -u postgres psql -d nubo_email < ../../init.sql
else
    echo "No init.sql found, creating tables manually..."
    sudo -u postgres psql -d nubo_email << 'SQL'
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
SQL
fi

echo ""
echo "================================================"
echo "   Setup Complete!"
echo "================================================"
echo ""
echo "Status:"
pm2 status
echo ""
echo "Your site should be accessible at:"
echo "  https://nubo.email"
echo "  https://api.nubo.email"
echo ""
echo "Check logs with: pm2 logs"
echo "Monitor with: pm2 monit"