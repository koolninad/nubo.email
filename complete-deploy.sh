#!/bin/bash

# Complete the deployment with nginx
echo "Completing deployment with nginx..."

cd /opt/nubo.email || cd /opt/nubo || exit 1

# Stop and remove existing containers
docker stop nubo-frontend nubo-backend 2>/dev/null
docker rm nubo-frontend nubo-backend 2>/dev/null

# Pull latest images
echo "Pulling latest images..."
docker pull koolninad/nubo-frontend:latest
docker pull koolninad/nubo-backend:latest

# Start services without nginx first
echo "Starting backend and frontend..."
docker-compose up -d postgres redis backend frontend

# Wait for services
sleep 10

# Now add nginx
echo "Starting nginx..."
docker run -d \
  --name nubo-nginx \
  --restart unless-stopped \
  -p 80:80 \
  -p 443:443 \
  -v $(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v $(pwd)/certbot/conf:/etc/letsencrypt:ro \
  -v $(pwd)/certbot/www:/var/www/certbot:ro \
  --network nuboemail_nubo-network \
  nginx:alpine

echo "Done! Services running:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "Testing endpoints:"
curl -s -o /dev/null -w "Frontend HTTPS: %{http_code}\n" https://nubo.email
curl -s -o /dev/null -w "API HTTPS: %{http_code}\n" https://api.nubo.email/health