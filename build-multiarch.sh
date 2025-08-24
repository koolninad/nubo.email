#!/bin/bash

# Build and push multi-architecture Docker images for Nubo.email

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOCKER_USERNAME="koolninad"
VERSION="1.0.0"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}     Building Multi-Architecture Images for Nubo.email      ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Check if buildx is available
if ! docker buildx version &> /dev/null; then
    echo -e "${YELLOW}Setting up Docker buildx...${NC}"
    docker buildx create --name nubo-builder --use
    docker buildx inspect --bootstrap
else
    # Use existing builder or create new one
    if ! docker buildx ls | grep -q nubo-builder; then
        docker buildx create --name nubo-builder --use
    else
        docker buildx use nubo-builder
    fi
fi

# Login to Docker Hub
echo -e "${YELLOW}Checking Docker Hub login...${NC}"
if ! docker info 2>/dev/null | grep -q "Username:"; then
    echo "Please log in to Docker Hub:"
    docker login -u ${DOCKER_USERNAME}
fi

# Build and push backend for multiple architectures
echo -e "${GREEN}Building backend for linux/amd64 and linux/arm64...${NC}"
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ${DOCKER_USERNAME}/nubo-backend:latest \
    --tag ${DOCKER_USERNAME}/nubo-backend:${VERSION} \
    --tag ${DOCKER_USERNAME}/nubo-backend:multiarch-${TIMESTAMP} \
    --push \
    ./nubo-backend

echo -e "${GREEN}✓ Backend multi-arch images pushed${NC}"

# Build and push frontend for multiple architectures
echo -e "${GREEN}Building frontend for linux/amd64 and linux/arm64...${NC}"
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --build-arg NEXT_PUBLIC_API_URL=http://localhost:5001/api \
    --tag ${DOCKER_USERNAME}/nubo-frontend:latest \
    --tag ${DOCKER_USERNAME}/nubo-frontend:${VERSION} \
    --tag ${DOCKER_USERNAME}/nubo-frontend:multiarch-${TIMESTAMP} \
    --push \
    ./nubo-frontend

echo -e "${GREEN}✓ Frontend multi-arch images pushed${NC}"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}        ✅ Multi-architecture build complete!              ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Images are now available for:${NC}"
echo "  • linux/amd64 (Intel/AMD servers)"
echo "  • linux/arm64 (ARM servers, Mac M1/M2)"
echo ""
echo -e "${YELLOW}Docker Hub URLs:${NC}"
echo "  • ${DOCKER_USERNAME}/nubo-backend:latest"
echo "  • ${DOCKER_USERNAME}/nubo-frontend:latest"
echo ""
echo -e "${GREEN}You can now deploy on any architecture!${NC}"
