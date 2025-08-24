#!/bin/bash

# Nubo.email Production Deployment with Proper Domains
# Frontend: nubo.email
# Backend API: api.nubo.email

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

DEPLOYMENT_DIR="/opt/nubo"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║      Nubo.email Production Deployment with Subdomains         ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}This script must be run as root${NC}"
    exit 1
fi

echo -e "${YELLOW}Prerequisites:${NC}"
echo "  1. Domain 'nubo.email' pointing to this server"
echo "  2. Subdomain 'api.nubo.email' pointing to this server"
echo "  3. Ports 80 and 443 open in firewall"
echo ""
read -p "Are these configured? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Please configure DNS first:${NC}"
    echo "  - A record: nubo.email → your-server-ip"
    echo "  - A record: api.nubo.email → your-server-ip"
    exit 1
fi

# Setup directory
echo -e "${GREEN}Setting up deployment directory...${NC}"
mkdir -p ${DEPLOYMENT_DIR}
cd ${DEPLOYMENT_DIR}
mkdir -p certbot/www certbot/conf

# Clone repository
if [ ! -d ".git" ]; then
    echo -e "${GREEN}Cloning repository...${NC}"
    git clone https://github.com/koolninad/nubo.email.git .
fi

# Generate secure passwords
echo -e "${GREEN}Generating secure passwords...${NC}"
POSTGRES_PASS=$(openssl rand -hex 32)
REDIS_PASS=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 48)
ENCRYPTION_KEY=$(openssl rand -hex 16)

# Get SMTP settings
echo -e "${YELLOW}Email Configuration (for password reset, notifications):${NC}"
read -p "SMTP Host (default: smtp.gmail.com): " SMTP_HOST
SMTP_HOST=${SMTP_HOST:-smtp.gmail.com}
read -p "SMTP Port (default: 587): " SMTP_PORT
SMTP_PORT=${SMTP_PORT:-587}
read -p "SMTP Username: " SMTP_USER
read -sp "SMTP Password: " SMTP_PASS
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
CORS_ORIGIN=https://nubo.email
NEXT_PUBLIC_API_URL=https://api.nubo.email/api

# Email Configuration
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}

# Domain
DOMAIN=nubo.email
API_DOMAIN=api.nubo.email
ENVFILE

chmod 600 .env

# Copy configuration files
echo -e "${GREEN}Setting up configuration files...${NC}"
cp docker-compose.production-final.yml docker-compose.yml
cp nginx-production.conf nginx.conf

# Create init.sql if not exists
if [ ! -f "init.sql" ]; then
    echo -e "${GREEN}Creating database schema...${NC}"
    cat > init.sql << 'SQL'
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
fi

# Generate temporary SSL certificate
echo -e "${YELLOW}Generating temporary SSL certificate...${NC}"
mkdir -p certbot/conf/live/nubo.email
openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
    -keyout certbot/conf/live/nubo.email/privkey.pem \
    -out certbot/conf/live/nubo.email/fullchain.pem \
    -subj "/CN=nubo.email" 2>/dev/null

# Start services
echo -e "${GREEN}Starting services...${NC}"
docker compose down 2>/dev/null || true
docker compose up -d

# Wait for services
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 30

# Get real SSL certificates
echo -e "${GREEN}Obtaining SSL certificates from Let's Encrypt...${NC}"
read -p "Enter email for SSL certificates: " SSL_EMAIL

# Stop nginx temporarily
docker compose stop nginx

# Get certificates for both domains
docker run -it --rm \
    -v ${DEPLOYMENT_DIR}/certbot/www:/var/www/certbot \
    -v ${DEPLOYMENT_DIR}/certbot/conf:/etc/letsencrypt \
    certbot/certbot certonly \
    --standalone \
    --email ${SSL_EMAIL} \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d nubo.email \
    -d api.nubo.email \
    -d www.nubo.email

# Restart nginx with real certificates
docker compose start nginx

# Setup auto-renewal
echo -e "${GREEN}Setting up SSL auto-renewal...${NC}"
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "0 0,12 * * * docker compose -f ${DEPLOYMENT_DIR}/docker-compose.yml run --rm certbot renew --quiet && docker compose -f ${DEPLOYMENT_DIR}/docker-compose.yml restart nginx") | crontab -

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

Domains:
- Frontend: https://nubo.email
- API: https://api.nubo.email

SSL Email: ${SSL_EMAIL}
====================================
CREDS

chmod 600 credentials.txt

# Display completion
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           Deployment Complete! 🎉                             ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Your Nubo instance is now running!${NC}"
echo ""
echo -e "${YELLOW}📍 Access URLs:${NC}"
echo -e "  Frontend:  ${GREEN}https://nubo.email${NC}"
echo -e "  API:       ${GREEN}https://api.nubo.email${NC}"
echo ""
echo -e "${YELLOW}📄 Credentials saved to: ${DEPLOYMENT_DIR}/credentials.txt${NC}"
echo ""
echo -e "${YELLOW}🔧 Useful commands:${NC}"
echo "  Check status:    docker compose ps"
echo "  View logs:       docker compose logs -f"
echo "  Restart:         docker compose restart"
echo "  Update:          git pull && docker compose pull && docker compose up -d"
echo ""
echo -e "${GREEN}🔒 SSL certificates have been configured for:${NC}"
echo "  - nubo.email"
echo "  - api.nubo.email"
echo "  - www.nubo.email (redirects to nubo.email)"
echo ""
echo -e "${GREEN}Your email service is ready at https://nubo.email${NC}"
echo ""
