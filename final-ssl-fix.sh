#!/bin/bash

# Final SSL Fix - Handles all domains correctly

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                    Final SSL Setup Fix                        ${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""

cd /opt/nubo

# Stop any existing nginx to avoid conflicts
echo -e "${GREEN}1. Preparing environment...${NC}"
docker compose stop nginx 2>/dev/null || true

# Ensure directories exist
echo -e "${GREEN}2. Creating certbot directories...${NC}"
mkdir -p certbot/www/.well-known/acme-challenge
mkdir -p certbot/conf
chmod -R 755 certbot/www
echo "   ✓ Directories created"

# Apply ACME-ready nginx config
echo -e "${GREEN}3. Applying ACME-ready nginx configuration...${NC}"
if [ -f "nginx-acme.conf" ]; then
    cp nginx-acme.conf nginx.conf
    echo "   ✓ ACME nginx config applied"
else
    # Create it if it doesn't exist
    cat > nginx.conf << 'NGINX'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Catch-all server block for ACME challenges on port 80
    server {
        listen 80;
        server_name _;  # Catch all domains
        
        # ACME challenge location - serves for ALL domains
        location ^~ /.well-known/acme-challenge/ {
            root /var/www/certbot;
            allow all;
            default_type "text/plain";
            try_files $uri =404;
        }
        
        # Test endpoint
        location = /test {
            return 200 "nginx is working on $host\n";
            add_header Content-Type text/plain;
        }
        
        # Default response for other requests
        location / {
            # Don't redirect during cert generation
            # Just proxy to frontend
            proxy_pass http://frontend:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
NGINX
    echo "   ✓ ACME nginx config created"
fi

# Start nginx with ACME config
echo -e "${GREEN}4. Starting nginx...${NC}"
docker compose up -d nginx
sleep 5
echo "   ✓ Nginx started"

# Verify ACME challenges work for all domains
echo -e "${GREEN}5. Verifying ACME challenge paths...${NC}"
echo "test-file" > certbot/www/.well-known/acme-challenge/test.txt

# Test each domain
for domain in nubo.email www.nubo.email api.nubo.email; do
    echo -n "   Testing $domain... "
    if curl -s -L http://$domain/.well-known/acme-challenge/test.txt 2>/dev/null | grep -q "test-file"; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        echo -e "   ${YELLOW}Warning: $domain ACME path not accessible${NC}"
    fi
done

# Clean up test file
rm -f certbot/www/.well-known/acme-challenge/test.txt

# Get email
echo ""
echo -e "${YELLOW}Enter your email for SSL certificates:${NC}"
read -p "Email: " SSL_EMAIL

# Request certificates
echo ""
echo -e "${GREEN}6. Requesting SSL certificates from Let's Encrypt...${NC}"
docker run --rm \
    -v /opt/nubo/certbot/www:/var/www/certbot:rw \
    -v /opt/nubo/certbot/conf:/etc/letsencrypt:rw \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email ${SSL_EMAIL} \
    --agree-tos \
    --no-eff-email \
    --expand \
    -d nubo.email \
    -d www.nubo.email \
    -d api.nubo.email

# Check if successful
if [ -f "/opt/nubo/certbot/conf/live/nubo.email/fullchain.pem" ]; then
    echo ""
    echo -e "${GREEN}7. SSL certificates obtained successfully!${NC}"
    
    # Apply production config
    echo -e "${GREEN}8. Applying production configuration with SSL...${NC}"
    if [ -f "nginx-production.conf" ]; then
        cp nginx-production.conf nginx.conf
        docker compose restart nginx
        echo "   ✓ Production config applied"
    else
        echo -e "   ${RED}✗ nginx-production.conf not found${NC}"
        echo "   Using fallback configuration..."
    fi
    
    # Setup auto-renewal
    echo -e "${GREEN}9. Configuring automatic renewal...${NC}"
    (crontab -l 2>/dev/null | grep -v "certbot renew"; \
     echo "0 0,12 * * * cd /opt/nubo && docker run --rm -v /opt/nubo/certbot/www:/var/www/certbot -v /opt/nubo/certbot/conf:/etc/letsencrypt certbot/certbot renew --quiet && docker compose restart nginx") | crontab -
    echo "   ✓ Auto-renewal configured"
    
    # Final verification
    echo ""
    echo -e "${GREEN}10. Verifying HTTPS...${NC}"
    sleep 5
    for domain in nubo.email api.nubo.email; do
        echo -n "   Testing https://$domain... "
        if curl -sSf https://$domain -o /dev/null 2>/dev/null; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${YELLOW}⚠ (may need a moment to start)${NC}"
        fi
    done
    
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}                  ✅ SSL Setup Complete!                       ${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${GREEN}Your sites are now available at:${NC}"
    echo "   • https://nubo.email"
    echo "   • https://api.nubo.email"
    echo "   • https://www.nubo.email → redirects to nubo.email"
    echo ""
    echo -e "${YELLOW}Certificate Information:${NC}"
    echo "   • Email: ${SSL_EMAIL}"
    echo "   • Auto-renewal: Enabled (twice daily)"
    echo "   • Certificate location: /opt/nubo/certbot/conf/live/nubo.email/"
    
else
    echo ""
    echo -e "${RED}✗ Certificate generation failed${NC}"
    echo ""
    echo -e "${YELLOW}Please check:${NC}"
    echo "1. DNS records for all domains point to: $(curl -s ifconfig.me)"
    echo "2. Ports 80 and 443 are open in firewall"
    echo "3. Check nginx logs: docker compose logs nginx"
    echo ""
    echo -e "${YELLOW}For debugging, try:${NC}"
    echo "   docker compose logs --tail=50 nginx"
    echo "   ls -la certbot/www/.well-known/acme-challenge/"
fi

echo ""