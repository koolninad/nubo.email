#!/bin/bash

# FINAL COMPREHENSIVE FIX FOR PRODUCTION SERVER
# This script fixes all issues once and for all

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║            FINAL PRODUCTION FIX - NUBO.EMAIL                  ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Ensure we're in the right directory
cd /opt/nubo

# Stop everything first
echo -e "${GREEN}1. Stopping all existing containers...${NC}"
docker compose down 2>/dev/null || true
docker stop $(docker ps -q) 2>/dev/null || true

# Use the correct docker-compose file
echo -e "${GREEN}2. Setting up correct docker-compose configuration...${NC}"
cp docker-compose.production-final.yml docker-compose.yml
echo "   ✓ Production docker-compose.yml in place"

# Ensure nginx config exists
echo -e "${GREEN}3. Checking nginx configuration...${NC}"
if [ ! -f "nginx.conf" ]; then
    if [ -f "nginx-production.conf" ]; then
        cp nginx-production.conf nginx.conf
        echo "   ✓ Production nginx config copied"
    else
        echo -e "${YELLOW}   Creating initial nginx config for SSL setup...${NC}"
        cat > nginx.conf << 'NGINX'
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        server_name nubo.email www.nubo.email api.nubo.email;
        
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        location / {
            proxy_pass http://frontend:3000;
            proxy_set_header Host $host;
        }
    }
}
NGINX
        echo "   ✓ Initial nginx config created"
    fi
fi

# Ensure directories exist
echo -e "${GREEN}4. Creating required directories...${NC}"
mkdir -p certbot/www certbot/conf
echo "   ✓ Certbot directories ready"

# Pull latest images
echo -e "${GREEN}5. Pulling latest Docker images...${NC}"
docker compose pull

# Start core services first
echo -e "${GREEN}6. Starting database services...${NC}"
docker compose up -d postgres redis
sleep 10

# Start application services
echo -e "${GREEN}7. Starting application services...${NC}"
docker compose up -d backend frontend

# Start nginx
echo -e "${GREEN}8. Starting nginx...${NC}"
docker compose up -d nginx

# Start certbot
echo -e "${GREEN}9. Starting certbot...${NC}"
docker compose up -d certbot

# Wait for services
echo -e "${YELLOW}10. Waiting for services to stabilize...${NC}"
sleep 15

# Check status
echo -e "${GREEN}11. Checking service status...${NC}"
docker compose ps

echo ""
echo -e "${GREEN}12. Service logs:${NC}"
echo -e "${YELLOW}Backend:${NC}"
docker compose logs --tail=10 backend

echo ""
echo -e "${YELLOW}Frontend:${NC}"
docker compose logs --tail=10 frontend

echo ""
echo -e "${YELLOW}Nginx:${NC}"
docker compose logs --tail=10 nginx

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    DEPLOYMENT STATUS                          ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if services are running
BACKEND_STATUS=$(docker compose ps backend --format json | jq -r '.Status' 2>/dev/null || echo "Not running")
FRONTEND_STATUS=$(docker compose ps frontend --format json | jq -r '.Status' 2>/dev/null || echo "Not running")
NGINX_STATUS=$(docker compose ps nginx --format json | jq -r '.Status' 2>/dev/null || echo "Not running")

echo -e "Backend:  ${BACKEND_STATUS}"
echo -e "Frontend: ${FRONTEND_STATUS}"
echo -e "Nginx:    ${NGINX_STATUS}"
echo ""

# SSL Certificate check
if [ -d "/opt/nubo/certbot/conf/live/nubo.email" ]; then
    echo -e "${GREEN}✅ SSL certificates found${NC}"
else
    echo -e "${YELLOW}⚠️  SSL certificates not found${NC}"
    echo ""
    echo -e "${YELLOW}To setup SSL certificates, run:${NC}"
    echo "  ./fix-ssl-certificates.sh"
fi

echo ""
echo -e "${GREEN}✨ Deployment complete!${NC}"
echo ""
echo -e "${YELLOW}Access your services:${NC}"
if [ -d "/opt/nubo/certbot/conf/live/nubo.email" ]; then
    echo "  Frontend: https://nubo.email"
    echo "  API:      https://api.nubo.email"
else
    echo "  Frontend: http://nubo.email"
    echo "  API:      http://api.nubo.email"
    echo ""
    echo -e "${YELLOW}Run ./fix-ssl-certificates.sh to enable HTTPS${NC}"
fi

echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  Check status:  docker compose ps"
echo "  View logs:     docker compose logs -f [service]"
echo "  Restart all:   docker compose restart"
echo "  Stop all:      docker compose down"
echo ""