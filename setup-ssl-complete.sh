#!/bin/bash

# Complete SSL Setup for Nubo.email
# This script properly sets up SSL certificates with Let's Encrypt

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              SSL Certificate Setup - Nubo.email               ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd /opt/nubo

# Check if nginx is running
echo -e "${GREEN}1. Checking nginx status...${NC}"
if ! docker compose ps nginx | grep -q "running"; then
    echo -e "${YELLOW}   Starting nginx...${NC}"
    docker compose up -d nginx
    sleep 5
fi

# Create initial HTTP-only nginx config for cert generation
echo -e "${GREEN}2. Setting up initial HTTP configuration for certificate generation...${NC}"
cat > nginx-http-only.conf << 'NGINX'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen 80;
        server_name nubo.email www.nubo.email api.nubo.email;
        
        # Allow Let's Encrypt verification
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        # Temporary proxy to frontend
        location / {
            proxy_pass http://frontend:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
    
    # API on port 80 temporarily
    server {
        listen 80;
        server_name api.nubo.email;
        
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        location / {
            proxy_pass http://backend:5001;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
}
NGINX

# Apply HTTP-only config
cp nginx-http-only.conf nginx.conf
docker compose exec nginx nginx -s reload || docker compose restart nginx
sleep 3

# Get SSL certificates
echo -e "${GREEN}3. Obtaining SSL certificates from Let's Encrypt...${NC}"
echo -e "${YELLOW}   Please provide your email for SSL certificate registration:${NC}"
read -p "   Email: " SSL_EMAIL

# Ensure certbot directories exist
mkdir -p certbot/www certbot/conf

echo -e "${GREEN}4. Running certbot to obtain certificates...${NC}"
docker run --rm \
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
    -d www.nubo.email \
    -d api.nubo.email

# Check if certificates were created
if [ ! -f "/opt/nubo/certbot/conf/live/nubo.email/fullchain.pem" ]; then
    echo -e "${RED}❌ Certificate generation failed!${NC}"
    echo -e "${YELLOW}   Please ensure your domains are pointing to this server:${NC}"
    echo "   - nubo.email → $(curl -s ifconfig.me)"
    echo "   - www.nubo.email → $(curl -s ifconfig.me)"
    echo "   - api.nubo.email → $(curl -s ifconfig.me)"
    exit 1
fi

echo -e "${GREEN}5. SSL certificates obtained successfully!${NC}"
echo -e "${GREEN}6. Applying production nginx configuration with SSL...${NC}"

# Use the production nginx config
if [ -f "nginx-production.conf" ]; then
    cp nginx-production.conf nginx.conf
    echo "   ✓ Production nginx config applied"
else
    echo -e "${RED}   Production nginx config not found!${NC}"
    exit 1
fi

# Reload nginx with SSL configuration
echo -e "${GREEN}7. Reloading nginx with SSL configuration...${NC}"
docker compose exec nginx nginx -s reload || docker compose restart nginx

# Setup auto-renewal
echo -e "${GREEN}8. Setting up automatic certificate renewal...${NC}"
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "0 0,12 * * * cd /opt/nubo && docker run --rm -v /opt/nubo/certbot/www:/var/www/certbot -v /opt/nubo/certbot/conf:/etc/letsencrypt certbot/certbot renew --quiet && docker compose exec nginx nginx -s reload") | crontab -

# Verify SSL is working
echo -e "${GREEN}9. Verifying SSL configuration...${NC}"
sleep 5

# Test HTTPS endpoints
if curl -sSf https://nubo.email -o /dev/null 2>/dev/null; then
    echo -e "   ✓ Frontend HTTPS working"
else
    echo -e "   ⚠ Frontend HTTPS may need a moment to start"
fi

if curl -sSf https://api.nubo.email/health -o /dev/null 2>/dev/null; then
    echo -e "   ✓ API HTTPS working"
else
    echo -e "   ⚠ API HTTPS may need a moment to start"
fi

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                 SSL Setup Complete! 🔒                        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Your sites are now available with SSL:${NC}"
echo "   • https://nubo.email"
echo "   • https://api.nubo.email"
echo "   • https://www.nubo.email (redirects to nubo.email)"
echo ""
echo -e "${YELLOW}Certificate details:${NC}"
echo "   • Email: ${SSL_EMAIL}"
echo "   • Domains: nubo.email, www.nubo.email, api.nubo.email"
echo "   • Auto-renewal: Enabled (runs twice daily)"
echo ""
echo -e "${YELLOW}To manually renew certificates:${NC}"
echo "   docker run --rm -v /opt/nubo/certbot/www:/var/www/certbot -v /opt/nubo/certbot/conf:/etc/letsencrypt certbot/certbot renew"
echo ""
echo -e "${YELLOW}To check certificate status:${NC}"
echo "   docker run --rm -v /opt/nubo/certbot/conf:/etc/letsencrypt certbot/certbot certificates"
echo ""