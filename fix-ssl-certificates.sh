#!/bin/bash

# Quick SSL Certificate Fix for Already Running Deployment

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}SSL Certificate Fix Script${NC}"
echo ""

cd /opt/nubo

# Make sure nginx is running with basic HTTP config
echo -e "${GREEN}Ensuring nginx is running...${NC}"

# Create temporary HTTP-only nginx config
cat > nginx-temp.conf << 'NGINX'
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

# Update nginx to use temp config
cp nginx-temp.conf nginx.conf
docker compose restart nginx
sleep 5

# Get SSL certificates
echo -e "${GREEN}Getting SSL certificates...${NC}"
read -p "Enter email for SSL certificates: " SSL_EMAIL

docker run -it --rm \
    -v /opt/nubo/certbot/www:/var/www/certbot \
    -v /opt/nubo/certbot/conf:/etc/letsencrypt \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email ${SSL_EMAIL} \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d nubo.email \
    -d api.nubo.email \
    -d www.nubo.email

# Update to production nginx config
echo -e "${GREEN}Updating nginx with SSL configuration...${NC}"
if [ -f "nginx-production.conf" ]; then
    cp nginx-production.conf nginx.conf
else
    # Download from GitHub if not present
    curl -s https://raw.githubusercontent.com/koolninad/nubo.email/main/nginx-production.conf > nginx.conf
fi

# Restart nginx with SSL
docker compose restart nginx

echo ""
echo -e "${GREEN}✅ SSL certificates installed successfully!${NC}"
echo ""
echo -e "${YELLOW}Your sites are now available at:${NC}"
echo "  - https://nubo.email"
echo "  - https://api.nubo.email"
echo ""
