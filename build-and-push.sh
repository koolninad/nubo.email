#!/bin/bash

# Nubo.email Docker Build and Push Script
# This script builds and pushes Docker images to Docker Hub

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Docker Hub username
DOCKER_USERNAME="koolninad"
VERSION="1.0.0"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo -e "${GREEN}🚀 Starting Nubo.email Docker build and push process${NC}"

# Check if logged in to Docker Hub
echo -e "${YELLOW}Checking Docker Hub login...${NC}"
if ! docker info 2>/dev/null | grep -q "Username: ${DOCKER_USERNAME}"; then
    echo -e "${YELLOW}Please log in to Docker Hub:${NC}"
    docker login -u ${DOCKER_USERNAME}
fi

# Build backend image
echo -e "${GREEN}Building backend image...${NC}"
docker build -t ${DOCKER_USERNAME}/nubo-backend:${VERSION} \
             -t ${DOCKER_USERNAME}/nubo-backend:latest \
             -t ${DOCKER_USERNAME}/nubo-backend:${TIMESTAMP} \
             ./nubo-backend

# Build frontend image
echo -e "${GREEN}Building frontend image...${NC}"
docker build -t ${DOCKER_USERNAME}/nubo-frontend:${VERSION} \
             -t ${DOCKER_USERNAME}/nubo-frontend:latest \
             -t ${DOCKER_USERNAME}/nubo-frontend:${TIMESTAMP} \
             --build-arg NEXT_PUBLIC_API_URL=http://localhost:5001/api \
             ./nubo-frontend

# Push backend images
echo -e "${GREEN}Pushing backend images to Docker Hub...${NC}"
docker push ${DOCKER_USERNAME}/nubo-backend:${VERSION}
docker push ${DOCKER_USERNAME}/nubo-backend:latest
docker push ${DOCKER_USERNAME}/nubo-backend:${TIMESTAMP}

# Push frontend images
echo -e "${GREEN}Pushing frontend images to Docker Hub...${NC}"
docker push ${DOCKER_USERNAME}/nubo-frontend:${VERSION}
docker push ${DOCKER_USERNAME}/nubo-frontend:latest
docker push ${DOCKER_USERNAME}/nubo-frontend:${TIMESTAMP}

echo -e "${GREEN}✅ Docker images successfully built and pushed!${NC}"
echo -e "${GREEN}Images available at:${NC}"
echo -e "  - ${DOCKER_USERNAME}/nubo-backend:latest"
echo -e "  - ${DOCKER_USERNAME}/nubo-frontend:latest"
echo -e "${GREEN}Tagged with: latest, ${VERSION}, ${TIMESTAMP}${NC}"
