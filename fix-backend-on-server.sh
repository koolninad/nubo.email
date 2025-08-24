#!/bin/bash

# Fix backend Redis issue on server

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}Fixing backend Redis import issue${NC}"
echo ""

cd /opt/nubo

# Pull the latest backend image
echo -e "${GREEN}Pulling latest backend image...${NC}"
docker compose pull backend

# Stop and remove the old backend container
echo -e "${GREEN}Stopping old backend container...${NC}"
docker compose stop backend
docker compose rm -f backend

# Start the backend with the new image
echo -e "${GREEN}Starting backend with fixed Redis import...${NC}"
docker compose up -d backend

# Wait for backend to start
echo -e "${YELLOW}Waiting for backend to initialize...${NC}"
sleep 10

# Check backend status
echo -e "${GREEN}Checking backend status...${NC}"
docker compose ps backend
docker compose logs --tail=20 backend

echo ""
echo -e "${GREEN}✅ Backend fix applied!${NC}"
echo ""
echo -e "${YELLOW}Monitor logs with:${NC}"
echo "  docker compose logs -f backend"
echo ""