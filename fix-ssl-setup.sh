#!/bin/bash

# Fixed SSL Setup Script - Handles ACME challenge properly

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}SSL Certificate Setup - Fixed Version${NC}"
echo ""

cd /opt/nubo

# Ensure directories exist with correct permissions
echo -e "${GREEN}1. Creating certbot directories...${NC}"
mkdir -p certbot/www/.well-known/acme-challenge
mkdir -p certbot/conf
chmod -R 755 certbot/www

# Create a test file to verify webroot is working
echo "test" > certbot/www/.well-known/acme-challenge/test.txt

# Create simple HTTP nginx config that properly serves ACME challenges
echo -e "${GREEN}2. Setting up nginx for ACME challenges...${NC}"
cat > nginx.conf << 'NGINX'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Main server block for all domains
    server {
        listen 80 default_server;
        server_name nubo.email www.nubo.email api.nubo.email;
        
        # ACME challenge location - MUST be first
        location ^~ /.well-known/acme-challenge/ {
            root /var/www/certbot;
            allow all;
            default_type "text/plain";
        }
        
        # Test location
        location = /test {
            return 200 "nginx is working\n";
            add_header Content-Type text/plain;
        }
        
        # Redirect everything else to HTTPS (after we have certs)
        location / {
            # For now, just proxy to frontend
            proxy_pass http://frontend:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
}
NGINX

# Restart nginx with new config
echo -e "${GREEN}3. Restarting nginx...${NC}"
docker compose restart nginx
sleep 5

# Test if ACME challenge path is accessible
echo -e "${GREEN}4. Testing ACME challenge path...${NC}"
if curl -s http://nubo.email/.well-known/acme-challenge/test.txt | grep -q "test"; then
    echo -e "   ${GREEN}✓ ACME challenge path is accessible${NC}"
else
    echo -e "   ${RED}✗ ACME challenge path is NOT accessible${NC}"
    echo -e "   ${YELLOW}Debugging...${NC}"
    docker compose logs --tail=20 nginx
    echo ""
    echo -e "   ${YELLOW}Please ensure DNS is configured:${NC}"
    echo "   - nubo.email → $(curl -s ifconfig.me)"
    echo "   - www.nubo.email → $(curl -s ifconfig.me)"
    echo "   - api.nubo.email → $(curl -s ifconfig.me)"
fi

# Clean up test file
rm -f certbot/www/.well-known/acme-challenge/test.txt

# Get email for SSL
echo ""
echo -e "${YELLOW}Enter email for SSL certificates:${NC}"
read -p "Email: " SSL_EMAIL

# Request certificates with better error handling
echo -e "${GREEN}5. Requesting SSL certificates...${NC}"
docker run --rm \
    -v /opt/nubo/certbot/www:/var/www/certbot:rw \
    -v /opt/nubo/certbot/conf:/etc/letsencrypt:rw \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email ${SSL_EMAIL} \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d nubo.email \
    -d www.nubo.email \
    -d api.nubo.email \
    --verbose

# Check if certificates were created
if [ -f "/opt/nubo/certbot/conf/live/nubo.email/fullchain.pem" ]; then
    echo -e "${GREEN}6. Certificates obtained successfully!${NC}"
    
    # Apply production nginx config with SSL
    echo -e "${GREEN}7. Applying production configuration...${NC}"
    if [ -f "nginx-production.conf" ]; then
        cp nginx-production.conf nginx.conf
        docker compose restart nginx
        echo -e "   ${GREEN}✓ SSL configuration applied${NC}"
    else
        echo -e "   ${RED}✗ nginx-production.conf not found${NC}"
    fi
    
    # Setup auto-renewal
    echo -e "${GREEN}8. Setting up auto-renewal...${NC}"
    (crontab -l 2>/dev/null | grep -v "certbot renew"; \
     echo "0 0,12 * * * cd /opt/nubo && docker run --rm -v /opt/nubo/certbot/www:/var/www/certbot -v /opt/nubo/certbot/conf:/etc/letsencrypt certbot/certbot renew --quiet && docker compose restart nginx") | crontab -
    echo -e "   ${GREEN}✓ Auto-renewal configured${NC}"
    
    echo ""
    echo -e "${GREEN}✅ SSL Setup Complete!${NC}"
    echo ""
    echo -e "${CYAN}Your sites are now available at:${NC}"
    echo "   • https://nubo.email"
    echo "   • https://api.nubo.email"
    echo "   • https://www.nubo.email (redirects to nubo.email)"
else
    echo -e "${RED}✗ Certificate generation failed${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting steps:${NC}"
    echo "1. Verify DNS records point to this server:"
    echo "   - Your server IP: $(curl -s ifconfig.me)"
    echo "   - nubo.email should resolve to this IP"
    echo "   - www.nubo.email should resolve to this IP"
    echo "   - api.nubo.email should resolve to this IP"
    echo ""
    echo "2. Check if port 80 is accessible from internet:"
    echo "   curl http://nubo.email/test"
    echo ""
    echo "3. Check nginx logs:"
    echo "   docker compose logs nginx"
    echo ""
    echo "4. Try manual test:"
    echo "   mkdir -p certbot/www/.well-known/acme-challenge"
    echo "   echo 'test' > certbot/www/.well-known/acme-challenge/test.txt"
    echo "   curl http://nubo.email/.well-known/acme-challenge/test.txt"
fi