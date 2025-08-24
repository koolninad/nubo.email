#!/bin/bash

# Nubo.email Final Fixed Deployment Script
# Fixes Redis health check and multi-arch issues

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
DEPLOYMENT_DIR="/opt/nubo"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        Nubo.email Final Deployment Script v2.0                ║${NC}"
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

# Generate secure passwords (alphanumeric only)
echo -e "${GREEN}Generating secure passwords...${NC}"
POSTGRES_PASS=$(openssl rand -hex 32)
REDIS_PASS=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 48)
ENCRYPTION_KEY=$(openssl rand -hex 16)

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

# Create environment file
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
CORS_ORIGIN=http://${DOMAIN}
NEXT_PUBLIC_API_URL=http://${DOMAIN}:5001/api

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

# Create docker-compose.yml with fixed Redis health check
echo -e "${GREEN}Creating docker-compose.yml...${NC}"
cat > docker-compose.yml << COMPOSE
services:
  postgres:
    image: postgres:16-alpine
    platform: linux/amd64
    container_name: nubo-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: nubo_email
      POSTGRES_USER: nubo
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - nubo-network
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nubo -d nubo_email"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    platform: linux/amd64
    container_name: nubo-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass \${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - nubo-network
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a \${REDIS_PASSWORD} ping | grep PONG"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: node:18-alpine
    platform: linux/amd64
    container_name: nubo-backend
    restart: unless-stopped
    working_dir: /app
    command: sh -c "cd /app && npm install && npm run build && npm start"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 5001
      DATABASE_URL: \${DATABASE_URL}
      REDIS_URL: redis://:\${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: \${JWT_SECRET}
      ENCRYPTION_KEY: \${ENCRYPTION_KEY}
      CORS_ORIGIN: \${CORS_ORIGIN}
      SMTP_HOST: \${SMTP_HOST}
      SMTP_PORT: \${SMTP_PORT}
      SMTP_USER: \${SMTP_USER}
      SMTP_PASS: \${SMTP_PASS}
    volumes:
      - ./nubo-backend:/app
      - backend_node_modules:/app/node_modules
    ports:
      - "5001:5001"
    networks:
      - nubo-network

  frontend:
    image: node:18-alpine
    platform: linux/amd64
    container_name: nubo-frontend
    restart: unless-stopped
    working_dir: /app
    command: sh -c "cd /app && npm install && npm run build && npm start"
    depends_on:
      - backend
    environment:
      NODE_ENV: production
      PORT: 3000
      API_URL: http://backend:5001/api
      NEXT_PUBLIC_API_URL: \${NEXT_PUBLIC_API_URL}
    volumes:
      - ./nubo-frontend:/app
      - frontend_node_modules:/app/node_modules
      - frontend_next:/app/.next
    ports:
      - "3000:3000"
    networks:
      - nubo-network

volumes:
  postgres_data:
  redis_data:
  backend_node_modules:
  frontend_node_modules:
  frontend_next:

networks:
  nubo-network:
    driver: bridge
COMPOSE

# Create database init script
echo -e "${GREEN}Creating database initialization script...${NC}"
cat > init.sql << 'SQL'
-- Nubo Email Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nubo;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO nubo;
SQL

# Clone the repository to get source code
echo -e "${GREEN}Getting source code...${NC}"
if [ ! -d "nubo-backend" ] || [ ! -d "nubo-frontend" ]; then
    echo -e "${YELLOW}Cloning Nubo repository...${NC}"
    git clone https://github.com/koolninad/nubo.email.git temp_repo 2>/dev/null || true
    
    if [ -d "temp_repo/nubo-backend" ]; then
        cp -r temp_repo/nubo-backend ./
    fi
    
    if [ -d "temp_repo/nubo-frontend" ]; then
        cp -r temp_repo/nubo-frontend ./
    fi
    
    rm -rf temp_repo
fi

# Start services
echo -e "${GREEN}Starting services...${NC}"
docker compose down 2>/dev/null || true
docker compose up -d

# Wait for services
echo -e "${YELLOW}Waiting for services to start (this may take 2-3 minutes for first run)...${NC}"
sleep 30

# Check service status
echo -e "${GREEN}Checking service status...${NC}"
docker compose ps

# Save credentials
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

====================================
CREDS

chmod 600 credentials.txt

# Display completion
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    Deployment Complete!                       ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Services are starting up!${NC}"
echo ""
echo -e "${YELLOW}📍 Access URLs:${NC}"
echo -e "  Frontend:    http://${DOMAIN}:3000"
echo -e "  Backend API: http://${DOMAIN}:5001"
echo ""
echo -e "${YELLOW}📄 Credentials saved to: ${DEPLOYMENT_DIR}/credentials.txt${NC}"
echo ""
echo -e "${YELLOW}🔧 Useful commands:${NC}"
echo "  Check status:    docker compose ps"
echo "  View all logs:   docker compose logs -f"
echo "  Frontend logs:   docker compose logs -f frontend"
echo "  Backend logs:    docker compose logs -f backend"
echo "  Redis logs:      docker compose logs -f redis"
echo "  Restart all:     docker compose restart"
echo "  Stop all:        docker compose down"
echo ""
echo -e "${YELLOW}⚠️  Note: First startup may take 2-3 minutes while dependencies install${NC}"
echo ""
echo -e "${GREEN}Monitor startup progress with: docker compose logs -f${NC}"
echo ""
