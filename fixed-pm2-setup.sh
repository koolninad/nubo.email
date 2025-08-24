#!/bin/bash

# Fixed PM2 setup with correct PostgreSQL configuration

set -e

echo "================================================"
echo "   Fixed PM2 Setup for Nubo.email"
echo "================================================"

# Check root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root"
   exit 1
fi

# Install dependencies
echo "Installing dependencies..."
apt update
apt install -y nodejs npm postgresql postgresql-contrib redis-server nginx certbot python3-certbot-nginx git
npm install -g pm2

# Setup PostgreSQL (with correct port detection)
echo "Setting up PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

# Detect PostgreSQL port
PG_PORT=$(sudo -u postgres psql -t -c "SELECT setting FROM pg_settings WHERE name='port';" 2>/dev/null | tr -d ' ' || echo "5432")
echo "PostgreSQL is running on port: $PG_PORT"

# Create database and user using sudo -u postgres
echo "Creating database and user..."
sudo -u postgres psql << EOF
DROP DATABASE IF EXISTS nubo_email;
DROP USER IF EXISTS nubo;
CREATE USER nubo WITH PASSWORD 'nubo_password_2024';
CREATE DATABASE nubo_email OWNER nubo;
GRANT ALL PRIVILEGES ON DATABASE nubo_email TO nubo;
\q
EOF

# Configure PostgreSQL to accept password authentication
echo "Configuring PostgreSQL authentication..."
PG_VERSION=$(sudo -u postgres psql -t -c "SELECT version();" | grep -oP '\d+\.\d+' | head -1 | cut -d. -f1)
PG_CONFIG="/etc/postgresql/$PG_VERSION/main/postgresql.conf"
PG_HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"

# Update pg_hba.conf to allow password authentication for nubo user
if [ -f "$PG_HBA" ]; then
    # Backup original
    cp $PG_HBA ${PG_HBA}.backup
    
    # Add line for nubo user if not exists
    if ! grep -q "local.*nubo_email.*nubo" $PG_HBA; then
        sed -i '/^local   all             all                                     peer/i local   nubo_email      nubo                                    md5' $PG_HBA
    fi
    
    # Reload PostgreSQL
    systemctl reload postgresql
fi

# Start Redis
echo "Starting Redis..."
systemctl start redis-server
systemctl enable redis-server

# Setup project directory
echo "Setting up project directory..."
rm -rf /var/www/nubo
mkdir -p /var/www/nubo
cd /var/www/nubo

# Clone repository
echo "Cloning repository..."
git clone https://github.com/koolninad/nubo.email.git .

# Check structure
echo "Project structure:"
ls -la

# Setup Backend
echo "Setting up backend..."
cd /var/www/nubo/nubo-backend
npm install

# Create backend .env with correct port
cat > .env << EOF
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_PORT=$PG_PORT
DB_NAME=nubo_email
DB_USER=nubo
DB_PASSWORD=nubo_password_2024
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_key_change_this_2024
CORS_ORIGIN=https://nubo.email
FRONTEND_URL=https://nubo.email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EOF

# Build backend
echo "Building backend..."
npm run build

# Setup Frontend
echo "Setting up frontend..."
cd /var/www/nubo/nubo-frontend
npm install

# Create frontend .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://api.nubo.email
EOF

# Build frontend
echo "Building frontend..."
npm run build

# Initialize database
echo "Initializing database..."
cd /var/www/nubo

# Create init.sql if not exists
cat > init.sql << 'SQL'
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
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);
SQL

# Initialize database using sudo -u postgres
echo "Running database initialization..."
sudo -u postgres psql -d nubo_email < init.sql

echo "Database initialized successfully"

# Create PM2 ecosystem file
echo "Creating PM2 configuration..."
cat > /var/www/nubo/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'nubo-backend',
      script: 'dist/index.js',
      cwd: '/var/www/nubo/nubo-backend',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/var/log/pm2/backend-error.log',
      out_file: '/var/log/pm2/backend-out.log',
      merge_logs: true,
      time: true,
      max_memory_restart: '500M'
    },
    {
      name: 'nubo-frontend',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/nubo/nubo-frontend',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/pm2/frontend-error.log',
      out_file: '/var/log/pm2/frontend-out.log',
      merge_logs: true,
      time: true,
      max_memory_restart: '500M'
    }
  ]
};
EOF

# Create log directory
mkdir -p /var/log/pm2

# Stop any existing PM2 processes
pm2 delete all 2>/dev/null || true

# Start with PM2
echo "Starting applications with PM2..."
cd /var/www/nubo
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# Configure Nginx
echo "Configuring Nginx..."

# Check for existing SSL certificates
SSL_PATH=""
if [ -d "/opt/nubo.email/certbot/conf/live/nubo.email" ]; then
    SSL_PATH="/opt/nubo.email/certbot/conf/live/nubo.email"
    echo "Found existing SSL certificates in /opt/nubo.email"
elif [ -d "/etc/letsencrypt/live/nubo.email" ]; then
    SSL_PATH="/etc/letsencrypt/live/nubo.email"
    echo "Found existing SSL certificates in /etc/letsencrypt"
fi

if [ -n "$SSL_PATH" ]; then
    # Create HTTPS configuration
    cat > /etc/nginx/sites-available/nubo << EOF
# Rate limiting
limit_req_zone \$binary_remote_addr zone=general:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=api:10m rate=30r/s;

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
        return 301 https://\$server_name\$request_uri;
    }
}

# Frontend - nubo.email
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name nubo.email www.nubo.email;

    ssl_certificate ${SSL_PATH}/fullchain.pem;
    ssl_certificate_key ${SSL_PATH}/privkey.pem;
    
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
    
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
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

    ssl_certificate ${SSL_PATH}/fullchain.pem;
    ssl_certificate_key ${SSL_PATH}/privkey.pem;
    
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
    
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
    echo "Nginx configured with HTTPS"
else
    echo "No SSL certificates found. Please run certbot to get certificates."
fi

# Enable site and reload nginx
ln -sf /etc/nginx/sites-available/nubo /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Setup log rotation
echo "Setting up log rotation..."
cat > /etc/logrotate.d/nubo << 'EOF'
/var/log/pm2/*.log {
    daily
    rotate 14
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

# Test database connection
echo ""
echo "Testing database connection..."
sudo -u postgres psql -d nubo_email -c "SELECT 'Database connection successful!' as status;"

# Final status
echo ""
echo "================================================"
echo "   PM2 Setup Complete!"
echo "================================================"
echo ""
echo "Application Status:"
pm2 status
echo ""
echo "Service Status:"
echo "• PostgreSQL: $(systemctl is-active postgresql) (Port: $PG_PORT)"
echo "• Redis: $(systemctl is-active redis-server)"
echo "• Nginx: $(systemctl is-active nginx)"
echo ""

if [ -n "$SSL_PATH" ]; then
    echo "Your site is accessible at:"
    echo "  • https://nubo.email"
    echo "  • https://api.nubo.email"
else
    echo "⚠️  SSL not configured. To enable HTTPS, run:"
    echo "  certbot --nginx -d nubo.email -d www.nubo.email -d api.nubo.email"
fi

echo ""
echo "Database credentials:"
echo "  • Database: nubo_email"
echo "  • User: nubo"
echo "  • Password: nubo_password_2024"
echo "  • Port: $PG_PORT"
echo ""
echo "Useful commands:"
echo "  • pm2 status        - Check app status"
echo "  • pm2 logs          - View all logs"
echo "  • pm2 logs 0        - View backend logs"
echo "  • pm2 logs 1        - View frontend logs"
echo "  • pm2 restart all   - Restart all apps"
echo "  • pm2 monit         - Real-time monitoring"
echo ""
echo "Database commands:"
echo "  • sudo -u postgres psql -d nubo_email  - Connect to database"
echo ""
echo "⚠️  Remember to:"
echo "  1. Change database password in production"
echo "  2. Update JWT_SECRET in /var/www/nubo/nubo-backend/.env"
echo "  3. Configure SMTP settings for email functionality"