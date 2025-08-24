#!/bin/bash

# Apply existing SSL certificates and fix database

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}         Applying SSL Certificates & Fixing Database           ${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""

cd /opt/nubo

# Check if certificates exist
echo -e "${GREEN}1. Checking SSL certificates...${NC}"
if [ -f "certbot/conf/live/nubo.email/fullchain.pem" ]; then
    echo -e "   ${GREEN}✓ SSL certificates found${NC}"
    
    # Apply production nginx config
    echo -e "${GREEN}2. Applying production nginx configuration...${NC}"
    if [ -f "nginx-production.conf" ]; then
        cp nginx-production.conf nginx.conf
        echo -e "   ${GREEN}✓ Production config applied${NC}"
    else
        echo -e "   ${RED}✗ nginx-production.conf not found${NC}"
    fi
    
    # Restart nginx
    echo -e "${GREEN}3. Restarting nginx with SSL...${NC}"
    docker compose restart nginx
    sleep 5
    echo -e "   ${GREEN}✓ Nginx restarted${NC}"
    
    # Test HTTPS
    echo -e "${GREEN}4. Testing HTTPS endpoints...${NC}"
    for domain in nubo.email api.nubo.email; do
        echo -n "   Testing https://$domain... "
        if curl -sSf https://$domain -o /dev/null 2>/dev/null; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${YELLOW}⚠ May need a moment${NC}"
        fi
    done
else
    echo -e "   ${RED}✗ SSL certificates not found${NC}"
    echo -e "   Run: ./final-ssl-fix.sh first"
fi

echo ""
echo -e "${GREEN}5. Fixing database...${NC}"
echo -e "${YELLOW}   This will reset the database to a clean state.${NC}"
echo -e "${YELLOW}   All existing users and data will be removed.${NC}"
echo ""
read -p "   Continue? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Stop backend to prevent conflicts
    echo -e "${GREEN}6. Stopping backend...${NC}"
    docker compose stop backend
    
    # Reset database
    echo -e "${GREEN}7. Resetting database...${NC}"
    
    # Drop and recreate database
    docker compose exec -T postgres psql -U nubo -d postgres << 'SQL'
DROP DATABASE IF EXISTS nubo_email;
CREATE DATABASE nubo_email;
SQL
    
    # Apply schema
    echo -e "${GREEN}8. Applying database schema...${NC}"
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

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nubo;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO nubo;
SQL
    
    echo -e "   ${GREEN}✓ Database reset complete${NC}"
    
    # Restart backend
    echo -e "${GREEN}9. Starting backend...${NC}"
    docker compose up -d backend
    sleep 5
    echo -e "   ${GREEN}✓ Backend started${NC}"
    
    # Check backend health
    echo -e "${GREEN}10. Checking backend health...${NC}"
    if curl -sSf https://api.nubo.email/health -o /dev/null 2>/dev/null; then
        echo -e "   ${GREEN}✓ Backend is healthy${NC}"
    else
        echo -e "   ${YELLOW}⚠ Backend may need a moment to start${NC}"
        echo -e "   Check logs: docker compose logs backend"
    fi
else
    echo -e "${YELLOW}   Database reset skipped${NC}"
fi

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    Setup Complete!                            ${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Your Nubo.email instance is ready:${NC}"
echo "   • Frontend: https://nubo.email"
echo "   • API: https://api.nubo.email"
echo ""
echo -e "${YELLOW}Database status:${NC}"
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   • Database has been reset"
    echo "   • You can now create a new account"
else
    echo "   • Database unchanged"
    echo "   • Existing users remain"
fi
echo ""
echo -e "${YELLOW}To monitor services:${NC}"
echo "   docker compose ps"
echo "   docker compose logs -f [service]"
echo ""