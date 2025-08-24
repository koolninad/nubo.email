#!/bin/bash

# Nubo.email Fresh Deployment Script
# Complete cleanup and fresh installation with Let's Encrypt

set -e

echo "================================================"
echo "   Nubo.email Fresh Deployment"
echo "================================================"

# Configuration - CHANGE THESE!
EMAIL="your-email@example.com"  # YOUR EMAIL FOR SSL CERTIFICATES
DOMAIN="nubo.email"
API_DOMAIN="api.nubo.email"

# Colors for output
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

# Step 1: Complete cleanup
print_warning "This will delete ALL Docker containers, volumes, and networks!"
read -p "Are you sure you want to continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

print_status "Stopping all containers..."
docker stop $(docker ps -aq) 2>/dev/null || true

print_status "Removing all containers..."
docker rm $(docker ps -aq) 2>/dev/null || true

print_status "Removing all volumes..."
docker volume rm $(docker volume ls -q) 2>/dev/null || true

print_status "Removing all networks..."
docker network rm $(docker network ls -q | grep -v bridge | grep -v host | grep -v none) 2>/dev/null || true

print_status "Cleaning up Docker system..."
docker system prune -af --volumes

# Step 2: Create fresh directory structure
print_status "Creating fresh directory structure..."
cd /opt
rm -rf nubo
mkdir -p nubo
cd nubo

mkdir -p nginx
mkdir -p certbot/conf
mkdir -p certbot/www

# Step 3: Create database initialization script
print_status "Creating database initialization script..."
cat > init.sql << 'EOF'
-- Create tables for Nubo.email

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
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_email_accounts_user_id ON email_accounts(user_id);
EOF

# Step 4: Create .env file with generated passwords
print_status "Creating .env file with secure passwords..."

# Generate secure passwords
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-50)

cat > .env << EOF
# Database
DB_PASSWORD=${DB_PASSWORD}

# JWT
JWT_SECRET=${JWT_SECRET}

# SMTP (configure these with your email provider)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EOF

chmod 600 .env
print_warning "Generated passwords saved in /opt/nubo/.env"
print_warning "Configure SMTP settings later for password reset emails"

# Step 5: Create initial nginx configuration (HTTP only)
print_status "Creating initial nginx configuration..."

cat > nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # HTTP server for Let's Encrypt verification
    server {
        listen 80;
        listen [::]:80;
        server_name nubo.email www.nubo.email api.nubo.email;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 444;  # Drop connection until SSL is ready
        }
    }
}
EOF

# Step 6: Create docker-compose.yml
print_status "Creating docker-compose.yml..."

cat > docker-compose.yml << EOF
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: nubo-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    networks:
      - nubo-network
    command: "/bin/sh -c 'while :; do sleep 6h & wait \$\${!}; nginx -s reload; done & nginx -g \"daemon off;\"'"

  certbot:
    image: certbot/certbot
    container_name: nubo-certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait \$\${!}; done;'"

  postgres:
    image: postgres:15-alpine
    container_name: nubo-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: nubo
      POSTGRES_USER: nubo
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - nubo-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nubo"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: nubo-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - nubo-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: koolninad/nubo-backend:latest
    container_name: nubo-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 5000
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: nubo
      DB_USER: nubo
      DB_PASSWORD: \${DB_PASSWORD}
      REDIS_URL: redis://redis:6379
      JWT_SECRET: \${JWT_SECRET}
      CORS_ORIGIN: https://nubo.email
      SMTP_HOST: \${SMTP_HOST}
      SMTP_PORT: \${SMTP_PORT}
      SMTP_SECURE: \${SMTP_SECURE}
      SMTP_USER: \${SMTP_USER}
      SMTP_PASS: \${SMTP_PASS}
      FRONTEND_URL: https://nubo.email
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - nubo-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    image: koolninad/nubo-frontend:latest
    container_name: nubo-frontend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: https://api.nubo.email
    networks:
      - nubo-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  nubo-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
EOF

# Step 7: Start basic services
print_status "Starting basic services (without nginx first)..."
docker-compose up -d postgres redis
sleep 10  # Wait for database to initialize

print_status "Starting backend and frontend..."
docker-compose up -d backend frontend
sleep 10  # Wait for services to be ready

print_status "Starting nginx..."
docker-compose up -d nginx

# Step 8: Check if services are healthy
print_status "Checking service health..."
docker-compose ps

# Step 9: Request SSL certificates
print_status "Requesting Let's Encrypt certificates..."
print_warning "Make sure your domains point to this server!"
print_warning "Using email: $EMAIL"

docker-compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d $DOMAIN \
    -d www.$DOMAIN \
    -d $API_DOMAIN

# Step 10: Update nginx configuration with SSL
print_status "Updating nginx configuration with SSL..."

cat > nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

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

    # Frontend - nubo.email & www.nubo.email
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name nubo.email www.nubo.email;

        ssl_certificate /etc/letsencrypt/live/nubo.email/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/nubo.email/privkey.pem;
        
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

        location / {
            proxy_pass http://nubo-frontend:3000;
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

    # API Backend - api.nubo.email
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name api.nubo.email;

        ssl_certificate /etc/letsencrypt/live/nubo.email/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/nubo.email/privkey.pem;
        
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

        location / {
            proxy_pass http://nubo-backend:5000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
EOF

# Step 11: Reload nginx with SSL
print_status "Reloading nginx with SSL configuration..."
docker-compose exec nginx nginx -s reload

# Step 12: Start certbot for auto-renewal
print_status "Starting certbot for auto-renewal..."
docker-compose up -d certbot

# Step 13: Final status check
echo ""
echo "================================================"
echo "   Fresh Deployment Complete!"
echo "================================================"
echo ""
print_status "Frontend: https://nubo.email"
print_status "API: https://api.nubo.email"
echo ""
print_status "Database Password: Check /opt/nubo/.env"
print_status "JWT Secret: Check /opt/nubo/.env"
echo ""
print_warning "Configure SMTP in /opt/nubo/.env for password reset emails"
print_warning "Set Cloudflare SSL/TLS to 'Full (strict)' mode"
echo ""

# Show all containers
print_status "All containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
print_status "Testing endpoints:"
echo -n "Frontend: "
curl -s -o /dev/null -w "%{http_code}" https://nubo.email
echo ""
echo -n "API Health: "
curl -s https://api.nubo.email/health 2>/dev/null || echo "API starting..."
echo ""
echo ""
print_status "View logs: docker-compose logs -f [service]"
print_status "Stop all: docker-compose down"
print_status "Start all: docker-compose up -d"