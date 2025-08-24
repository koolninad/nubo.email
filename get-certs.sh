#!/bin/bash

# Quick script to get Let's Encrypt certificates

echo "Getting Let's Encrypt certificates..."

# Configuration - CHANGE THIS!
EMAIL="your-email@example.com"  # CHANGE TO YOUR EMAIL

cd /opt/nubo

# Make sure nginx is running
docker-compose up -d nginx

# Wait for nginx to be ready
sleep 5

# Remove any existing certificates
rm -rf certbot/conf/live
rm -rf certbot/conf/archive
rm -rf certbot/conf/renewal

# Get fresh certificates
docker run -it --rm \
    -v /opt/nubo/certbot/conf:/etc/letsencrypt \
    -v /opt/nubo/certbot/www:/var/www/certbot \
    --network nubo_nubo-network \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
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

    # Frontend - nubo.email & www.nubo.email
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name nubo.email www.nubo.email;

        ssl_certificate /etc/letsencrypt/live/nubo.email/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/nubo.email/privkey.pem;
        
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        
        add_header Strict-Transport-Security "max-age=31536000" always;

        location / {
            proxy_pass http://nubo-frontend:3000;
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

    # API Backend - api.nubo.email
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name api.nubo.email;

        ssl_certificate /etc/letsencrypt/live/nubo.email/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/nubo.email/privkey.pem;
        
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        
        add_header Strict-Transport-Security "max-age=31536000" always;

        location / {
            proxy_pass http://nubo-backend:5000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
EOF

    # Reload nginx
    docker-compose exec nginx nginx -s reload
    
    # Start certbot for auto-renewal
    docker-compose up -d certbot
    
    echo "✓ SSL configuration complete!"
    echo ""
    echo "Your site should now be accessible at:"
    echo "  https://nubo.email"
    echo "  https://api.nubo.email"
    echo ""
    echo "Set Cloudflare SSL/TLS to 'Full (strict)' mode"
else
    echo "✗ Failed to obtain certificates"
    echo "Check that your domains point to this server"
fi