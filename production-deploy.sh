#!/bin/bash

# Nubo.email Production Deployment - Complete Solution
# This is the ONLY script you need to deploy everything properly

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

DEPLOYMENT_DIR="/opt/nubo"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           Nubo.email Production Deployment                    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}This script must be run as root${NC}"
    exit 1
fi

cd ${DEPLOYMENT_DIR}

# ============= STEP 1: CLEAN DATABASE =============
echo -e "${GREEN}Step 1: Database Setup${NC}"
echo -e "${YELLOW}Do you want to reset the database? This will remove ALL existing users.${NC}"
read -p "Reset database? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Resetting database...${NC}"
    
    # Stop backend to prevent conflicts
    docker compose stop backend 2>/dev/null || true
    
    # Reset the database
    docker compose exec -T postgres psql -U nubo -d postgres << 'SQL'
DROP DATABASE IF EXISTS nubo_email;
CREATE DATABASE nubo_email;
SQL
    
    # Create clean schema
    docker compose exec -T postgres psql -U nubo -d nubo_email << 'SQL'
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

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nubo;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO nubo;
SQL
    
    echo -e "${GREEN}✓ Database reset complete${NC}"
fi

# ============= STEP 2: SETUP DOCKER COMPOSE =============
echo ""
echo -e "${GREEN}Step 2: Docker Compose Configuration${NC}"

# Use the production docker-compose
cp docker-compose.production-final.yml docker-compose.yml
echo -e "${GREEN}✓ Production docker-compose.yml configured${NC}"

# ============= STEP 3: SSL CERTIFICATES =============
echo ""
echo -e "${GREEN}Step 3: SSL Certificate Setup${NC}"

# Create directories
mkdir -p certbot/www/.well-known/acme-challenge
mkdir -p certbot/conf
chmod -R 755 certbot/www

# Check if certificates already exist
if [ -f "certbot/conf/live/nubo.email/fullchain.pem" ]; then
    echo -e "${GREEN}✓ SSL certificates already exist${NC}"
    SSL_EXISTS=true
else
    echo -e "${YELLOW}SSL certificates not found. Need to generate them.${NC}"
    SSL_EXISTS=false
fi

# ============= STEP 4: CONFIGURE NGINX =============
echo ""
echo -e "${GREEN}Step 4: Nginx Configuration${NC}"

if [ "$SSL_EXISTS" = false ]; then
    # Create HTTP-only config for certificate generation
    cat > nginx.conf << 'NGINX'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen 80 default_server;
        server_name _;
        
        location ^~ /.well-known/acme-challenge/ {
            root /var/www/certbot;
            allow all;
            default_type "text/plain";
        }
        
        location / {
            proxy_pass http://frontend:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
}
NGINX
    echo -e "${GREEN}✓ HTTP-only nginx config created for SSL generation${NC}"
else
    # Use production config with SSL
    cp nginx-production.conf nginx.conf
    echo -e "${GREEN}✓ Production nginx config with SSL applied${NC}"
fi

# ============= STEP 5: START SERVICES =============
echo ""
echo -e "${GREEN}Step 5: Starting Services${NC}"

# Pull latest images
docker compose pull

# Start services
docker compose up -d postgres redis
sleep 10
docker compose up -d backend frontend nginx certbot
sleep 10

echo -e "${GREEN}✓ All services started${NC}"

# ============= STEP 6: GENERATE SSL IF NEEDED =============
if [ "$SSL_EXISTS" = false ]; then
    echo ""
    echo -e "${GREEN}Step 6: Generating SSL Certificates${NC}"
    echo -e "${YELLOW}Enter your email for SSL certificates:${NC}"
    read -p "Email: " SSL_EMAIL
    
    # Generate certificates
    docker run --rm \
        -v ${DEPLOYMENT_DIR}/certbot/www:/var/www/certbot:rw \
        -v ${DEPLOYMENT_DIR}/certbot/conf:/etc/letsencrypt:rw \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email ${SSL_EMAIL} \
        --agree-tos \
        --no-eff-email \
        -d nubo.email \
        -d www.nubo.email \
        -d api.nubo.email
    
    if [ -f "certbot/conf/live/nubo.email/fullchain.pem" ]; then
        echo -e "${GREEN}✓ SSL certificates generated successfully${NC}"
        
        # Apply production config with SSL
        cp nginx-production.conf nginx.conf
        docker compose restart nginx
        echo -e "${GREEN}✓ SSL configuration applied${NC}"
    else
        echo -e "${RED}✗ SSL certificate generation failed${NC}"
        echo "Please check your DNS settings and try again"
    fi
fi

# ============= STEP 7: SETUP AUTO-RENEWAL =============
echo ""
echo -e "${GREEN}Step 7: Setting up SSL auto-renewal${NC}"
(crontab -l 2>/dev/null | grep -v "certbot renew"; \
 echo "0 0,12 * * * cd ${DEPLOYMENT_DIR} && docker run --rm -v ${DEPLOYMENT_DIR}/certbot/www:/var/www/certbot -v ${DEPLOYMENT_DIR}/certbot/conf:/etc/letsencrypt certbot/certbot renew --quiet && docker compose restart nginx") | crontab -
echo -e "${GREEN}✓ Auto-renewal configured${NC}"

# ============= STEP 8: VERIFY DEPLOYMENT =============
echo ""
echo -e "${GREEN}Step 8: Verifying Deployment${NC}"

# Check services
docker compose ps

# Test endpoints
echo ""
echo -e "${YELLOW}Testing endpoints...${NC}"
sleep 5

if [ "$SSL_EXISTS" = true ] || [ -f "certbot/conf/live/nubo.email/fullchain.pem" ]; then
    # Test HTTPS
    if curl -sSf https://nubo.email -o /dev/null 2>/dev/null; then
        echo -e "  Frontend: ${GREEN}✓ https://nubo.email${NC}"
    else
        echo -e "  Frontend: ${YELLOW}⚠ https://nubo.email (may need a moment)${NC}"
    fi
    
    if curl -sSf https://api.nubo.email/health -o /dev/null 2>/dev/null; then
        echo -e "  API:      ${GREEN}✓ https://api.nubo.email${NC}"
    else
        echo -e "  API:      ${YELLOW}⚠ https://api.nubo.email (may need a moment)${NC}"
    fi
else
    # Test HTTP
    if curl -sSf http://nubo.email -o /dev/null 2>/dev/null; then
        echo -e "  Frontend: ${GREEN}✓ http://nubo.email${NC}"
    else
        echo -e "  Frontend: ${RED}✗ http://nubo.email${NC}"
    fi
fi

# ============= FINAL STATUS =============
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                   Deployment Complete!                        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ -f "certbot/conf/live/nubo.email/fullchain.pem" ]; then
    echo -e "${GREEN}Your Nubo instance is available at:${NC}"
    echo "  • https://nubo.email"
    echo "  • https://api.nubo.email"
else
    echo -e "${YELLOW}Your Nubo instance is available at:${NC}"
    echo "  • http://nubo.email (SSL not configured)"
    echo "  • http://api.nubo.email (SSL not configured)"
    echo ""
    echo -e "${YELLOW}To setup SSL, run this script again.${NC}"
fi

echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  Check status:  docker compose ps"
echo "  View logs:     docker compose logs -f [service]"
echo "  Restart all:   docker compose restart"
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Database was reset - you can now create new accounts${NC}"
else
    echo -e "${YELLOW}Database was not reset - existing users remain${NC}"
fi
echo ""