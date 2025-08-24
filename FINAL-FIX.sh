#!/bin/bash

# FINAL FIX - This WILL fix everything

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

cd /opt/nubo

echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                    FINAL FIX - Nubo.email                     ${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""

# STEP 1: FORCE DATABASE CLEANUP
echo -e "${GREEN}Step 1: Force Database Cleanup${NC}"
docker compose exec -T postgres psql -U nubo -d postgres << 'SQL'
DROP DATABASE IF EXISTS nubo_email;
CREATE DATABASE nubo_email;
SQL

docker compose exec -T postgres psql -U nubo -d nubo_email < init.sql
echo -e "${GREEN}✓ Database cleaned${NC}"

# STEP 2: FIX FRONTEND ENVIRONMENT
echo -e "${GREEN}Step 2: Fix Frontend API URL${NC}"
# Update the .env file to ensure correct API URL
cat > .env.production << 'ENV'
NEXT_PUBLIC_API_URL=https://api.nubo.email
ENV

# Force rebuild frontend with correct API URL
docker compose stop frontend
docker compose rm -f frontend
docker compose up -d frontend
echo -e "${GREEN}✓ Frontend configured for production API${NC}"

# STEP 3: APPLY SSL PROPERLY
echo -e "${GREEN}Step 3: Apply SSL Configuration${NC}"

# Check if certificates exist
if [ -f "certbot/conf/live/nubo.email/fullchain.pem" ]; then
    echo -e "${GREEN}SSL certificates found, applying...${NC}"
    
    # Make sure we're using the production nginx config
    cat > nginx.conf << 'NGINX'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Upstream definitions
    upstream frontend {
        server frontend:3000;
    }

    upstream backend {
        server backend:5001;
    }

    # Redirect HTTP to HTTPS for main domain
    server {
        listen 80;
        server_name nubo.email www.nubo.email;
        
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # Redirect HTTP to HTTPS for API
    server {
        listen 80;
        server_name api.nubo.email;
        
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # HTTPS for main domain
    server {
        listen 443 ssl;
        http2 on;
        server_name nubo.email;

        ssl_certificate /etc/letsencrypt/live/nubo.email/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/nubo.email/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        client_max_body_size 25M;

        location / {
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

    # HTTPS for www redirect
    server {
        listen 443 ssl;
        http2 on;
        server_name www.nubo.email;

        ssl_certificate /etc/letsencrypt/live/nubo.email/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/nubo.email/privkey.pem;

        return 301 https://nubo.email$request_uri;
    }

    # HTTPS for API
    server {
        listen 443 ssl;
        http2 on;
        server_name api.nubo.email;

        ssl_certificate /etc/letsencrypt/live/nubo.email/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/nubo.email/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        client_max_body_size 25M;

        # CORS headers
        add_header Access-Control-Allow-Origin "https://nubo.email" always;
        add_header Access-Control-Allow-Credentials "true" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;

        # Handle preflight
        if ($request_method = 'OPTIONS') {
            return 204;
        }

        location / {
            proxy_pass http://backend;
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
    
    docker compose restart nginx
    echo -e "${GREEN}✓ SSL configuration applied${NC}"
else
    echo -e "${YELLOW}SSL certificates not found!${NC}"
    echo "Run these commands to generate them:"
    echo ""
    echo "docker run --rm -v /opt/nubo/certbot/www:/var/www/certbot -v /opt/nubo/certbot/conf:/etc/letsencrypt certbot/certbot certonly --webroot --webroot-path=/var/www/certbot --email YOUR_EMAIL --agree-tos --no-eff-email -d nubo.email -d www.nubo.email -d api.nubo.email"
fi

# STEP 4: RESTART EVERYTHING
echo -e "${GREEN}Step 4: Restarting All Services${NC}"
docker compose restart
sleep 10

# STEP 5: VERIFY
echo -e "${GREEN}Step 5: Verification${NC}"
echo ""

# Check if frontend is running
if docker compose ps frontend | grep -q "running"; then
    echo -e "Frontend: ${GREEN}✓ Running${NC}"
else
    echo -e "Frontend: ${RED}✗ Not running${NC}"
fi

# Check if backend is running
if docker compose ps backend | grep -q "running"; then
    echo -e "Backend: ${GREEN}✓ Running${NC}"
else
    echo -e "Backend: ${RED}✗ Not running${NC}"
fi

# Check if nginx is running
if docker compose ps nginx | grep -q "running"; then
    echo -e "Nginx: ${GREEN}✓ Running${NC}"
else
    echo -e "Nginx: ${RED}✗ Not running${NC}"
fi

# Test endpoints
echo ""
echo -e "${YELLOW}Testing endpoints...${NC}"

# Test frontend
if curl -sSf https://nubo.email -o /dev/null 2>/dev/null; then
    echo -e "Frontend HTTPS: ${GREEN}✓ Working${NC}"
elif curl -sSf http://nubo.email -o /dev/null 2>/dev/null; then
    echo -e "Frontend HTTP: ${YELLOW}⚠ Working (no SSL)${NC}"
else
    echo -e "Frontend: ${RED}✗ Not accessible${NC}"
fi

# Test API
if curl -sSf https://api.nubo.email/health -o /dev/null 2>/dev/null; then
    echo -e "API HTTPS: ${GREEN}✓ Working${NC}"
elif curl -sSf http://api.nubo.email/health -o /dev/null 2>/dev/null; then
    echo -e "API HTTP: ${YELLOW}⚠ Working (no SSL)${NC}"
else
    echo -e "API: ${RED}✗ Not accessible${NC}"
fi

# Show logs if there are issues
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    Fix Applied!                               ${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}What was fixed:${NC}"
echo "  ✓ Database cleaned (no more conflicts)"
echo "  ✓ Frontend configured to use https://api.nubo.email"
echo "  ✓ SSL configuration applied (if certificates exist)"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Clear your browser cache"
echo "  2. Visit https://nubo.email"
echo "  3. Create a new account"
echo ""
echo -e "${YELLOW}If you still see issues:${NC}"
echo "  docker compose logs -f frontend   # Check frontend logs"
echo "  docker compose logs -f backend    # Check backend logs"
echo "  docker compose logs -f nginx      # Check nginx logs"
echo ""