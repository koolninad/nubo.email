#!/bin/bash

# Quick script to update nginx configuration for existing deployment

echo "Updating nginx configuration for Docker..."

# Create SSL certificates if they don't exist
if [ ! -f /opt/nubo/ssl/fullchain.pem ]; then
    echo "Generating self-signed SSL certificates..."
    mkdir -p /opt/nubo/ssl
    
    openssl genrsa -out /opt/nubo/ssl/privkey.pem 2048
    openssl req -new -key /opt/nubo/ssl/privkey.pem \
        -out /opt/nubo/ssl/csr.pem \
        -subj "/C=US/ST=State/L=City/O=Nubo/CN=nubo.email"
    openssl x509 -req -days 365 -in /opt/nubo/ssl/csr.pem \
        -signkey /opt/nubo/ssl/privkey.pem \
        -out /opt/nubo/ssl/fullchain.pem
    
    chmod 600 /opt/nubo/ssl/privkey.pem
    chmod 644 /opt/nubo/ssl/fullchain.pem
    echo "SSL certificates created"
fi

# Create nginx config directory
mkdir -p /opt/nubo/nginx/logs

# Update nginx configuration
cat > /opt/nubo/nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    # MIME types
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        listen [::]:80;
        server_name nubo.email www.nubo.email api.nubo.email;
        
        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # Frontend - nubo.email
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name nubo.email www.nubo.email;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        
        # Cloudflare Real IP
        set_real_ip_from 173.245.48.0/20;
        set_real_ip_from 103.21.244.0/22;
        set_real_ip_from 103.22.200.0/22;
        set_real_ip_from 103.31.4.0/22;
        set_real_ip_from 141.101.64.0/18;
        set_real_ip_from 108.162.192.0/18;
        set_real_ip_from 190.93.240.0/20;
        set_real_ip_from 188.114.96.0/20;
        set_real_ip_from 197.234.240.0/22;
        set_real_ip_from 198.41.128.0/17;
        set_real_ip_from 162.158.0.0/15;
        set_real_ip_from 104.16.0.0/12;
        set_real_ip_from 172.64.0.0/13;
        set_real_ip_from 131.0.72.0/22;
        real_ip_header CF-Connecting-IP;

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

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        
        # Cloudflare Real IP
        set_real_ip_from 173.245.48.0/20;
        set_real_ip_from 103.21.244.0/22;
        set_real_ip_from 103.22.200.0/22;
        set_real_ip_from 103.31.4.0/22;
        set_real_ip_from 141.101.64.0/18;
        set_real_ip_from 108.162.192.0/18;
        set_real_ip_from 190.93.240.0/20;
        set_real_ip_from 188.114.96.0/20;
        set_real_ip_from 197.234.240.0/22;
        set_real_ip_from 198.41.128.0/17;
        set_real_ip_from 162.158.0.0/15;
        set_real_ip_from 104.16.0.0/12;
        set_real_ip_from 172.64.0.0/13;
        set_real_ip_from 131.0.72.0/22;
        real_ip_header CF-Connecting-IP;

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

echo "Nginx configuration updated"

# Check if nginx container exists
if docker ps -a | grep -q nubo-nginx; then
    echo "Restarting nginx container..."
    docker restart nubo-nginx
else
    echo "Starting nginx container..."
    docker run -d \
        --name nubo-nginx \
        --network nubo_default \
        -p 80:80 \
        -p 443:443 \
        -v /opt/nubo/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
        -v /opt/nubo/ssl:/etc/nginx/ssl:ro \
        -v /opt/nubo/nginx/logs:/var/log/nginx \
        --restart unless-stopped \
        nginx:alpine
fi

# Test nginx configuration
echo "Testing nginx configuration..."
docker exec nubo-nginx nginx -t

# Show status
echo ""
echo "Status:"
docker ps | grep nubo

echo ""
echo "Done! Your nginx container should now be running with SSL."
echo "Make sure Cloudflare SSL mode is set to 'Full' (not Full strict)"