#!/bin/bash

# Get Let's Encrypt certificates using standalone mode

echo "================================================"
echo "   Getting SSL Certificates (Standalone Mode)"
echo "================================================"

# Configuration - CHANGE THIS!
EMAIL="your-email@example.com"  # CHANGE TO YOUR EMAIL

cd /opt/nubo

# Step 1: Stop nginx temporarily to free port 80
echo "Stopping nginx temporarily..."
docker-compose stop nginx

# Step 2: Get certificates using standalone mode
echo "Requesting certificates..."
docker run -it --rm \
    -v /opt/nubo/certbot/conf:/etc/letsencrypt \
    -v /opt/nubo/certbot/www:/var/www/certbot \
    -p 80:80 \
    certbot/certbot certonly \
    --standalone \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d nubo.email \
    -d www.nubo.email \
    -d api.nubo.email

if [ $? -eq 0 ]; then
    echo "✓ Certificates obtained successfully!"
    
    # Update nginx configuration with SSL
    cat > /opt/nubo/nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # HTTP redirect to HTTPS
    server {
        listen 80;
        listen [::]:80;
        server_name nubo.email www.nubo.email api.nubo.email;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # Frontend
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name nubo.email www.nubo.email;

        ssl_certificate /etc/letsencrypt/live/nubo.email/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/nubo.email/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        location / {
            proxy_pass http://nubo-frontend:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }
    }

    # API
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name api.nubo.email;

        ssl_certificate /etc/letsencrypt/live/nubo.email/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/nubo.email/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        location / {
            proxy_pass http://nubo-backend:5000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }
    }
}
EOF

    # Start nginx with SSL
    echo "Starting nginx with SSL..."
    docker-compose up -d nginx
    
    # Start certbot for auto-renewal
    docker-compose up -d certbot
    
    echo ""
    echo "================================================"
    echo "✓ SSL Setup Complete!"
    echo "================================================"
    echo ""
    echo "Frontend: https://nubo.email"
    echo "API: https://api.nubo.email"
    echo ""
    echo "Testing endpoints..."
    sleep 5
    curl -I https://nubo.email 2>/dev/null | head -n 1
    curl -I https://api.nubo.email/health 2>/dev/null | head -n 1
else
    echo "✗ Failed to obtain certificates"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check that ports 80 and 443 are open"
    echo "2. Check that domains point to this server"
    echo "3. Try running: docker-compose logs"
    
    # Restart nginx anyway
    docker-compose up -d nginx
fi