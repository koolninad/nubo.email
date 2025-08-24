#!/bin/bash

# Nubo.email Production Deployment with Let's Encrypt
# This script sets up nginx with proper Let's Encrypt certificates

set -e

echo "================================================"
echo "   Nubo.email Let's Encrypt Deployment"
echo "================================================"

# Configuration
DOMAIN="nubo.email"
API_DOMAIN="api.nubo.email"
EMAIL="admin@nubo.email"  # Change this to your email

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Step 1: Create necessary directories
print_status "Creating directories..."
mkdir -p /opt/nubo/nginx
mkdir -p /opt/nubo/certbot/conf
mkdir -p /opt/nubo/certbot/www

# Step 2: Create initial nginx configuration (HTTP only for cert generation)
print_status "Creating initial nginx configuration for Let's Encrypt..."

cat > /opt/nubo/nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Initial HTTP server for Let's Encrypt verification
    server {
        listen 80;
        listen [::]:80;
        server_name nubo.email www.nubo.email api.nubo.email;

        # Let's Encrypt webroot location
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        # Redirect everything else to HTTPS (will be activated after certs)
        location / {
            return 444;  # Drop connection initially
        }
    }
}
EOF

# Step 3: Create docker-compose with certbot
print_status "Creating docker-compose configuration..."

cat > /opt/nubo/docker-compose.yml << 'EOF'
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
    depends_on:
      - frontend
      - backend
    networks:
      - nubo-network
    command: "/bin/sh -c 'while :; do sleep 6h & wait $${!}; nginx -s reload; done & nginx -g \"daemon off;\"'"

  certbot:
    image: certbot/certbot
    container_name: nubo-certbot
    restart: unless-stopped
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

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
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

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

# Step 4: Create .env file if it doesn't exist
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

# Step 5: Start nginx and other services
print_status "Starting services..."
cd /opt/nubo
docker-compose down 2>/dev/null || true
docker-compose up -d nginx postgres redis backend frontend

# Wait for nginx to be ready
sleep 5

# Step 6: Generate Let's Encrypt certificates
print_status "Generating Let's Encrypt certificates..."

# Get certificates for all domains
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

# Step 7: Update nginx configuration with SSL
print_status "Updating nginx configuration with SSL..."

cat > /opt/nubo/nginx/nginx.conf << 'EOF'
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

        # Let's Encrypt SSL
        ssl_certificate /etc/letsencrypt/live/nubo.email/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/nubo.email/privkey.pem;
        
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
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        
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
            proxy_pass http://nubo-frontend:3000;
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

        # Let's Encrypt SSL
        ssl_certificate /etc/letsencrypt/live/nubo.email/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/nubo.email/privkey.pem;
        
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
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        
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
            proxy_pass http://nubo-backend:5000;
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
}
EOF

# Step 8: Reload nginx with SSL configuration
print_status "Reloading nginx with SSL..."
docker-compose exec nginx nginx -s reload

# Step 9: Start certbot for auto-renewal
print_status "Starting certbot for auto-renewal..."
docker-compose up -d certbot

# Step 10: Show status
echo ""
echo "================================================"
echo "   Deployment Complete with Let's Encrypt!"
echo "================================================"
echo ""
print_status "Frontend: https://nubo.email"
print_status "API: https://api.nubo.email"
echo ""
print_warning "For Cloudflare: Set SSL/TLS mode to 'Full (strict)'"
print_warning "Certificates will auto-renew every 60 days"
echo ""

# Show container status
print_status "Container status:"
docker-compose ps

echo ""
print_status "Testing HTTPS endpoints:"
curl -I https://nubo.email 2>/dev/null | head -n 1
curl -I https://api.nubo.email/health 2>/dev/null | head -n 1