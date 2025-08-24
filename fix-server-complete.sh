#!/bin/bash

# Complete fix for server - pull images and start nginx

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}Complete Server Fix Script${NC}"
echo ""

cd /opt/nubo

# Pull all images
echo -e "${GREEN}Pulling latest Docker images...${NC}"
docker compose pull

# Stop everything first
echo -e "${GREEN}Stopping all containers...${NC}"
docker compose down

# Start services
echo -e "${GREEN}Starting all services...${NC}"
docker compose up -d

# Wait for services to start
echo -e "${YELLOW}Waiting for services to initialize...${NC}"
sleep 15

# Check service status
echo -e "${GREEN}Checking service status...${NC}"
docker compose ps

echo ""
echo -e "${GREEN}Backend logs:${NC}"
docker compose logs --tail=20 backend

echo ""
echo -e "${GREEN}Nginx status:${NC}"
docker compose logs --tail=10 nginx

echo ""
echo -e "${GREEN}✅ Services should be running!${NC}"
echo ""
echo -e "${YELLOW}Check status with:${NC}"
echo "  docker compose ps"
echo ""
echo -e "${YELLOW}Monitor logs with:${NC}"
echo "  docker compose logs -f"
echo ""
echo -e "${YELLOW}If SSL certificates are not yet installed, run:${NC}"
echo "  ./fix-ssl-certificates.sh"
echo ""