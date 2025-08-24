#!/bin/bash

# Nubo.email Production Deployment Script
# This script handles the complete deployment with SSL configuration for Cloudflare

set -e

echo "================================================"
echo "   Nubo.email Production Deployment"
echo "================================================"

# Configuration
DOMAIN="nubo.email"
API_DOMAIN="api.nubo.email"
SSL_DIR="/etc/nginx/ssl"
NGINX_DIR="/etc/nginx"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Step 1: Create SSL directory
print_status "Creating SSL directory..."
mkdir -p $SSL_DIR

# Step 2: Generate self-signed certificates for Cloudflare Full mode
print_status "Generating self-signed SSL certificates for Cloudflare..."

# Generate private key
openssl genrsa -out $SSL_DIR/privkey.pem 2048

# Generate certificate signing request
openssl req -new -key $SSL_DIR/privkey.pem \
    -out $SSL_DIR/csr.pem \
    -subj "/C=US/ST=State/L=City/O=Nubo/CN=$DOMAIN"

# Generate self-signed certificate (valid for 365 days)
openssl x509 -req -days 365 -in $SSL_DIR/csr.pem \
    -signkey $SSL_DIR/privkey.pem \
    -out $SSL_DIR/fullchain.pem

# Set proper permissions
chmod 600 $SSL_DIR/privkey.pem
chmod 644 $SSL_DIR/fullchain.pem

print_status "SSL certificates generated successfully"

# Step 3: Create optimized nginx configuration
print_status "Creating nginx configuration..."

cat > $NGINX_DIR/sites-available/nubo.conf << 'EOF'
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name nubo.email www.nubo.email api.nubo.email;
    
    # Allow Let's Encrypt challenges
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Frontend - nubo.email
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name nubo.email www.nubo.email;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Cloudflare Real IP
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    set_real_ip_from 103.31.4.0/22;
    set_real_ip_from 141.101.64.0/18;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 190.93.240.0/20;
    set_real_ip_from 188.114.96.0/20;
    set_real_ip_from 197.234.240.0/22;
    set_real_ip_from 198.41.128.0/17;
    set_real_ip_from 162.158.0.0/15;
    set_real_ip_from 104.16.0.0/12;
    set_real_ip_from 172.64.0.0/13;
    set_real_ip_from 131.0.72.0/22;
    real_ip_header CF-Connecting-IP;

    # Proxy to frontend container
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
        
        # WebSocket support
        proxy_read_timeout 86400;
    }
}

# API Backend - api.nubo.email
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.nubo.email;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Cloudflare Real IP
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    set_real_ip_from 103.31.4.0/22;
    set_real_ip_from 141.101.64.0/18;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 190.93.240.0/20;
    set_real_ip_from 188.114.96.0/20;
    set_real_ip_from 197.234.240.0/22;
    set_real_ip_from 198.41.128.0/17;
    set_real_ip_from 162.158.0.0/15;
    set_real_ip_from 104.16.0.0/12;
    set_real_ip_from 172.64.0.0/13;
    set_real_ip_from 131.0.72.0/22;
    real_ip_header CF-Connecting-IP;

    # Proxy to backend container
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase timeouts for API
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Step 4: Enable nginx configuration
print_status "Enabling nginx configuration..."
ln -sf $NGINX_DIR/sites-available/nubo.conf $NGINX_DIR/sites-enabled/
rm -f $NGINX_DIR/sites-enabled/default

# Test nginx configuration
nginx -t
if [ $? -eq 0 ]; then
    print_status "Nginx configuration is valid"
else
    print_error "Nginx configuration test failed"
    exit 1
fi

# Step 5: Reload nginx
print_status "Reloading nginx..."
systemctl reload nginx

# Step 6: Create docker-compose.yml
print_status "Creating docker-compose configuration..."

cat > /opt/nubo/docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: nubo-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: nubo
      POSTGRES_USER: nubo
      POSTGRES_PASSWORD: ${DB_PASSWORD}
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
    image: nubo-backend:latest
    container_name: nubo-backend
    restart: unless-stopped
    ports:
      - "127.0.0.1:5000:5000"
    environment:
      NODE_ENV: production
      PORT: 5000
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: nubo
      DB_USER: nubo
      DB_PASSWORD: ${DB_PASSWORD}
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      CORS_ORIGIN: https://nubo.email
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_SECURE: ${SMTP_SECURE}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      FRONTEND_URL: https://nubo.email
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - nubo-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    image: nubo-frontend:latest
    container_name: nubo-frontend
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: https://api.nubo.email
    networks:
      - nubo-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
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

# Step 7: Create .env file if it doesn't exist
if [ ! -f /opt/nubo/.env ]; then
    print_status "Creating .env file..."
    
    # Generate secure passwords
    DB_PASSWORD=$(openssl rand -base64 32)
    JWT_SECRET=$(openssl rand -base64 64)
    
    cat > /opt/nubo/.env << EOF
# Database
DB_PASSWORD=$DB_PASSWORD

# JWT
JWT_SECRET=$JWT_SECRET

# SMTP (configure these with your email provider)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EOF
    
    chmod 600 /opt/nubo/.env
    print_warning "Please configure SMTP settings in /opt/nubo/.env"
fi

# Step 8: Pull and start containers
print_status "Starting Docker containers..."
cd /opt/nubo
docker-compose pull
docker-compose up -d

# Step 9: Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 10

# Check service health
docker-compose ps

# Step 10: Show status
echo ""
echo "================================================"
echo "   Deployment Complete!"
echo "================================================"
echo ""
print_status "Frontend: https://nubo.email"
print_status "API: https://api.nubo.email"
echo ""
print_warning "Cloudflare SSL mode should be set to 'Full' (not Full strict)"
print_warning "Make sure both nubo.email and api.nubo.email point to this server"
echo ""

# Show container logs
print_status "Recent container logs:"
docker-compose logs --tail=20