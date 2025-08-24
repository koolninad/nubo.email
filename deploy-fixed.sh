#!/bin/bash

# Nubo.email Fixed Deployment Script
# This script properly handles password generation and escaping

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
DOCKER_USERNAME="koolninad"
DEPLOYMENT_DIR="/opt/nubo"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        Nubo.email Fixed Deployment Script v1.1                ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}This script must be run as root${NC}"
    exit 1
fi

# Setup directory
echo -e "${GREEN}Setting up deployment directory...${NC}"
mkdir -p ${DEPLOYMENT_DIR}
cd ${DEPLOYMENT_DIR}
mkdir -p certbot/www certbot/conf ssl

# Generate secure passwords (alphanumeric only to avoid issues)
echo -e "${GREEN}Generating secure passwords...${NC}"
POSTGRES_PASS=$(openssl rand -hex 32)
REDIS_PASS=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 48)
ENCRYPTION_KEY=$(openssl rand -hex 16)  # Exactly 32 characters when hex encoded

# Get user input
read -p "Enter your domain (e.g., nubo.example.com): " DOMAIN
read -p "Enter your email for SSL certificates: " SSL_EMAIL
read -p "Enter SMTP host (default: smtp.gmail.com): " SMTP_HOST
SMTP_HOST=${SMTP_HOST:-smtp.gmail.com}
read -p "Enter SMTP port (default: 587): " SMTP_PORT
SMTP_PORT=${SMTP_PORT:-587}
read -p "Enter SMTP username: " SMTP_USER
read -sp "Enter SMTP password: " SMTP_PASS
echo ""

# Create environment file with proper escaping
echo -e "${GREEN}Creating environment file...${NC}"
cat > .env << ENVFILE
# Database Configuration
POSTGRES_PASSWORD=${POSTGRES_PASS}
DATABASE_URL=postgresql://nubo:${POSTGRES_PASS}@postgres:5432/nubo_email

# Redis Configuration  
REDIS_PASSWORD=${REDIS_PASS}

# Security
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Application URLs
CORS_ORIGIN=https://${DOMAIN}
NEXT_PUBLIC_API_URL=https://${DOMAIN}/api

# Email Configuration
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}

# SSL Configuration
SSL_EMAIL=${SSL_EMAIL}
DOMAIN=${DOMAIN}
ENVFILE

chmod 600 .env

# Create docker-compose.yml
echo -e "${GREEN}Creating docker-compose.yml...${NC}"
cat > docker-compose.yml << 'COMPOSE'
services:
  postgres:
    image: postgres:16-alpine
    container_name: nubo-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: nubo_email
      POSTGRES_USER: nubo
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - nubo-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nubo -d nubo_email"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: nubo-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - nubo-network
    healthcheck:
      test: ["CMD", "redis-cli", "--auth", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: koolninad/nubo-backend:latest
    container_name: nubo-backend
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 5001
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      CORS_ORIGIN: ${CORS_ORIGIN}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
    ports:
      - "5001:5001"
    networks:
      - nubo-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:5001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    image: koolninad/nubo-frontend:latest
    container_name: nubo-frontend
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy
    environment:
      NODE_ENV: production
      API_URL: http://backend:5001/api
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
    ports:
      - "3000:3000"
    networks:
      - nubo-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    container_name: nubo-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/www:/var/www/certbot:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - nginx_cache:/var/cache/nginx
    depends_on:
      - frontend
      - backend
    networks:
      - nubo-network

volumes:
  postgres_data:
  redis_data:
  nginx_cache:

networks:
  nubo-network:
    driver: bridge
COMPOSE

# Create nginx.conf (HTTP only for now)
echo -e "${GREEN}Creating nginx configuration...${NC}"
cat > nginx.conf << 'NGINX'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=app_limit:10m rate=30r/s;

    # Upstream definitions
    upstream frontend {
        server frontend:3000;
    }

    upstream backend {
        server backend:5001;
    }

    # HTTP Server
    server {
        listen 80;
        server_name _;
        
        # Allow Let's Encrypt verification
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        # Client body size for file uploads
        client_max_body_size 25M;

        # API routes
        location /api {
            limit_req zone=api_limit burst=20 nodelay;
            
            proxy_pass http://backend:5001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Frontend application
        location / {
            limit_req zone=app_limit burst=50 nodelay;
            
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
}
NGINX

# Create database init script
echo -e "${GREEN}Creating database initialization script...${NC}"
cat > init.sql << 'SQL'
-- Nubo Email Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Email accounts table
CREATE TABLE IF NOT EXISTS email_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    imap_host VARCHAR(255) NOT NULL,
    imap_port INTEGER NOT NULL DEFAULT 993,
    imap_username VARCHAR(255) NOT NULL,
    imap_password TEXT NOT NULL,
    imap_use_ssl BOOLEAN DEFAULT true,
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_username VARCHAR(255) NOT NULL,
    smtp_password TEXT NOT NULL,
    smtp_use_ssl BOOLEAN DEFAULT true,
    signature TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_sync TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, email)
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nubo;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO nubo;
SQL

# Pull and start services
echo -e "${GREEN}Pulling Docker images...${NC}"
docker compose pull

echo -e "${GREEN}Starting services...${NC}"
docker compose up -d

# Wait for services to be ready
echo -e "${YELLOW}Waiting for services to be healthy (this may take a minute)...${NC}"
sleep 45

# Show status
docker compose ps

# Create backup script
echo -e "${GREEN}Creating backup script...${NC}"
cat > backup.sh << 'BACKUP'
#!/bin/bash
BACKUP_DIR="/opt/nubo/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p ${BACKUP_DIR}

# Backup database
docker exec nubo-postgres pg_dump -U nubo nubo_email | gzip > ${BACKUP_DIR}/db_${DATE}.sql.gz

# Keep only last 7 days of backups
find ${BACKUP_DIR} -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${BACKUP_DIR}/db_${DATE}.sql.gz"
BACKUP

chmod +x backup.sh

# Add to crontab
(crontab -l 2>/dev/null | grep -v "${DEPLOYMENT_DIR}/backup.sh"; echo "0 2 * * * ${DEPLOYMENT_DIR}/backup.sh") | crontab -

# Save passwords to file
echo -e "${GREEN}Saving credentials...${NC}"
cat > credentials.txt << CREDS
====================================
Nubo.email Deployment Credentials
====================================
Generated: $(date)

PostgreSQL Password: ${POSTGRES_PASS}
Redis Password: ${REDIS_PASS}
JWT Secret: ${JWT_SECRET}
Encryption Key: ${ENCRYPTION_KEY}

Domain: ${DOMAIN}
SSL Email: ${SSL_EMAIL}

IMPORTANT: Keep this file secure!
====================================
CREDS

chmod 600 credentials.txt

# Display completion message
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    Deployment Complete!                       ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Your Nubo instance is now running!${NC}"
echo ""
echo -e "${YELLOW}📍 Access URLs:${NC}"
echo -e "  Frontend:    http://${DOMAIN}:3000"
echo -e "  Backend API: http://${DOMAIN}:5001"
echo -e "  With Nginx:  http://${DOMAIN}"
echo ""
echo -e "${YELLOW}📄 Credentials saved to: ${DEPLOYMENT_DIR}/credentials.txt${NC}"
echo ""
echo -e "${YELLOW}🔧 Useful commands:${NC}"
echo "  View logs:       docker compose logs -f"
echo "  View frontend:   docker compose logs -f frontend"
echo "  View backend:    docker compose logs -f backend"
echo "  Restart all:     docker compose restart"
echo "  Stop all:        docker compose down"
echo "  Update images:   docker compose pull && docker compose up -d"
echo "  Manual backup:   ./backup.sh"
echo ""
echo -e "${YELLOW}🔒 Next Steps for SSL (optional):${NC}"
echo "  1. Make sure your domain points to this server"
echo "  2. Run this command to get SSL certificate:"
echo "     docker run -it --rm -v ${DEPLOYMENT_DIR}/certbot/www:/var/www/certbot -v ${DEPLOYMENT_DIR}/certbot/conf:/etc/letsencrypt certbot/certbot certonly --webroot --webroot-path=/var/www/certbot --email ${SSL_EMAIL} --agree-tos --no-eff-email -d ${DOMAIN}"
echo ""
echo -e "${GREEN}🎉 Deployment successful! Your email server is ready.${NC}"
echo ""
