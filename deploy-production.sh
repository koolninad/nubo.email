#!/bin/bash

# Production Deployment with Cloudflare Full Mode Support

set -e

echo "======================================"
echo "Nubo.email Production Deployment"
echo "======================================"
echo ""

cd /opt/nubo

# 1. Generate self-signed SSL certificates for Cloudflare Full mode
echo "Setting up SSL certificates..."
mkdir -p ssl
if [ ! -f "ssl/cert.pem" ]; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/key.pem \
        -out ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Nubo/CN=*.nubo.email"
    echo "✓ Self-signed SSL certificates created"
else
    echo "✓ SSL certificates already exist"
fi

# 2. Database setup
echo ""
echo "Reset database? (y/n)"
read -p "> " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker compose exec -T postgres psql -U nubo -d postgres << 'SQL' 2>/dev/null || true
DROP DATABASE IF EXISTS nubo_email;
CREATE DATABASE nubo_email;
SQL
    docker compose exec -T postgres psql -U nubo -d nubo_email < init.sql 2>/dev/null || true
    echo "✓ Database reset"
fi

# 3. Docker Compose configuration
cat > docker-compose.yml << 'COMPOSE'
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: nubo-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: nubo_email
      POSTGRES_USER: nubo
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - nubo-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nubo -d nubo_email"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: nubo-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - nubo-network
    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a ${REDIS_PASSWORD} ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: koolninad/nubo-backend:latest
    container_name: nubo-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 5001
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      CORS_ORIGIN: https://nubo.email
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
    networks:
      - nubo-network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  frontend:
    image: koolninad/nubo-frontend:latest
    container_name: nubo-frontend
    restart: unless-stopped
    environment:
      NODE_ENV: production
    networks:
      - nubo-network
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    container_name: nubo-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx-production.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    networks:
      - nubo-network
    depends_on:
      - frontend
      - backend

volumes:
  postgres_data:
  redis_data:

networks:
  nubo-network:
    driver: bridge
COMPOSE

echo "✓ Docker Compose configured"

# 4. Apply nginx configuration
cp nginx-production.conf nginx.conf 2>/dev/null || true

# 5. Check environment variables
if [ ! -f ".env" ]; then
    echo ""
    echo "WARNING: .env file not found!"
    echo "Create .env with:"
    echo "  POSTGRES_PASSWORD=<secure-password>"
    echo "  REDIS_PASSWORD=<secure-password>"
    echo "  DATABASE_URL=postgresql://nubo:<password>@postgres:5432/nubo_email"
    echo "  JWT_SECRET=<secret>"
    echo "  ENCRYPTION_KEY=<key>"
    echo "  SMTP_HOST=smtp.gmail.com"
    echo "  SMTP_PORT=587"
    echo "  SMTP_USER=<email>"
    echo "  SMTP_PASS=<password>"
    exit 1
fi

# 6. Deploy
echo ""
echo "Starting services..."
docker compose pull
docker compose down 2>/dev/null || true
docker compose up -d

# 7. Wait for services
echo "Waiting for services to start..."
sleep 10

# 8. Status check
echo ""
echo "======================================"
echo "Deployment Status"
echo "======================================"
docker compose ps

echo ""
echo "======================================"
echo "Cloudflare Configuration"
echo "======================================"
echo "1. Set SSL/TLS mode to 'Full' (not Full Strict)"
echo "2. Ensure DNS records are proxied (orange cloud):"
echo "   - A record: nubo.email → $(curl -s ifconfig.me)"
echo "   - A record: www.nubo.email → $(curl -s ifconfig.me)"
echo "   - A record: api.nubo.email → $(curl -s ifconfig.me)"
echo ""
echo "3. Clear browser cache and visit:"
echo "   - https://nubo.email"
echo ""
echo "======================================"
echo ""