#!/bin/bash

# Fix SSL for current setup
# Works with /opt/nubo.email directory

echo "================================================"
echo "   Fixing SSL Setup"
echo "================================================"

# Configuration - CHANGE THIS!
EMAIL="your-email@example.com"  # CHANGE TO YOUR EMAIL

# Work in the actual directory
cd /opt/nubo.email || cd /opt/nubo || exit 1

echo "Current directory: $(pwd)"

# Step 1: Stop all containers
echo "Stopping all containers..."
docker stop nubo-nginx nubo-frontend nubo-backend nubo-postgres nubo-redis 2>/dev/null || true
docker rm nubo-nginx nubo-frontend nubo-backend nubo-postgres nubo-redis 2>/dev/null || true

# Also try docker-compose
docker-compose down 2>/dev/null || true

# Make sure port 80 is free
echo "Checking port 80..."
lsof -i :80 | grep LISTEN && echo "Port 80 still in use, killing process..." && fuser -k 80/tcp

# Step 2: Create necessary directories
echo "Creating directories..."
mkdir -p certbot/conf
mkdir -p certbot/www
mkdir -p nginx

# Step 3: Get certificates using standalone mode
echo "Getting SSL certificates..."
docker run -it --rm \
    -v $(pwd)/certbot/conf:/etc/letsencrypt \
    -v $(pwd)/certbot/www:/var/www/certbot \
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
    
    # Step 4: Create nginx configuration with SSL
    echo "Creating nginx configuration..."
    cat > nginx/nginx.conf << 'EOF'
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
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;

        location / {
            proxy_pass http://frontend:3000;
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
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;

        location / {
            proxy_pass http://backend:5000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }
    }
}
EOF

    # Step 5: Update docker-compose.yml if needed
    if [ ! -f docker-compose.yml ]; then
        echo "Creating docker-compose.yml..."
        cat > docker-compose.yml << 'YAML'
services:
  nginx:
    image: nginx:alpine
    container_name: nubo-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    networks:
      - nubo-network

  postgres:
    image: postgres:15-alpine
    container_name: nubo-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: nubo
      POSTGRES_USER: nubo
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - nubo-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nubo"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: nubo-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - nubo-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: koolninad/nubo-backend:latest
    container_name: nubo-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 5000
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: nubo
      DB_USER: nubo
      DB_PASSWORD: ${DB_PASSWORD}
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      CORS_ORIGIN: https://nubo.email
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_SECURE: ${SMTP_SECURE}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      FRONTEND_URL: https://nubo.email
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - nubo-network

  frontend:
    image: koolninad/nubo-frontend:latest
    container_name: nubo-frontend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: https://api.nubo.email
    networks:
      - nubo-network

networks:
  nubo-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
YAML
    fi

    # Step 6: Create .env if missing
    if [ ! -f .env ]; then
        echo "Creating .env file..."
        DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
        JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-50)
        
        cat > .env << EOF
DB_PASSWORD=${DB_PASSWORD}
JWT_SECRET=${JWT_SECRET}
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EOF
    fi

    # Step 7: Start all services
    echo "Starting all services..."
    docker-compose up -d

    # Wait for services to be ready
    echo "Waiting for services to start..."
    sleep 10

    # Step 8: Check status
    echo ""
    echo "================================================"
    echo "✓ SSL Setup Complete!"
    echo "================================================"
    echo ""
    echo "Services running:"
    docker ps --format "table {{.Names}}\t{{.Status}}"
    echo ""
    echo "Your site should now be accessible at:"
    echo "  https://nubo.email"
    echo "  https://api.nubo.email"
    echo ""
    echo "Testing endpoints..."
    curl -s -o /dev/null -w "Frontend: %{http_code}\n" https://nubo.email
    curl -s -o /dev/null -w "API: %{http_code}\n" https://api.nubo.email/health
    
else
    echo "✗ Failed to obtain certificates"
    echo ""
    echo "Make sure:"
    echo "1. Your email is correct in this script"
    echo "2. Domains point to this server's IP"
    echo "3. Ports 80 and 443 are open in firewall"
    echo ""
    echo "You can check DNS with:"
    echo "  dig +short nubo.email"
    echo "  dig +short api.nubo.email"
fi