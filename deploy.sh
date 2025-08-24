#!/bin/bash

# Simple Nubo Deployment
# Works with Cloudflare proxy

set -e

echo "Nubo Deployment"
echo "==============="
echo ""

cd /opt/nubo

# 1. Clean database (optional)
echo "Do you want to reset the database? (y/n)"
read -p "> " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker compose exec -T postgres psql -U nubo -d postgres << 'SQL'
DROP DATABASE IF EXISTS nubo_email;
CREATE DATABASE nubo_email;
SQL
    docker compose exec -T postgres psql -U nubo -d nubo_email < init.sql
    echo "✓ Database reset"
fi

# 2. Use simple docker-compose
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

  redis:
    image: redis:7-alpine
    container_name: nubo-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - nubo-network

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
      - postgres
      - redis

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
    volumes:
      - ./nginx-cloudflare.conf:/etc/nginx/nginx.conf:ro
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

echo "✓ Docker compose configured"

# 3. Use Cloudflare-ready nginx
cp nginx-cloudflare.conf nginx.conf

# 4. Pull and restart
docker compose pull
docker compose up -d

echo ""
echo "✓ Deployment complete"
echo ""
echo "Configure in Cloudflare:"
echo "  - Set SSL/TLS to 'Flexible' or 'Full'"
echo "  - Add A records for:"
echo "    • nubo.email → your-server-ip"
echo "    • api.nubo.email → your-server-ip"
echo "    • www.nubo.email → your-server-ip"
echo ""
echo "Then access:"
echo "  • https://nubo.email"
echo "  • https://api.nubo.email"
echo ""