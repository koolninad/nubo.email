#!/bin/bash

# Nubo.email Docker Hub Push and Deployment Script
# This script pushes images to Docker Hub and provides deployment instructions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Docker Hub configuration
DOCKER_USERNAME="koolninad"
VERSION="1.0.0"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          Nubo.email Docker Deployment Script          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to push images
push_images() {
    echo -e "${YELLOW}📦 Pushing Docker images to Docker Hub...${NC}"
    echo -e "${YELLOW}Please ensure you're logged in to Docker Hub${NC}"
    echo ""
    
    # Tag images with version and timestamp
    echo -e "${GREEN}Tagging images...${NC}"
    docker tag ${DOCKER_USERNAME}/nubo-backend:latest ${DOCKER_USERNAME}/nubo-backend:${VERSION}
    docker tag ${DOCKER_USERNAME}/nubo-backend:latest ${DOCKER_USERNAME}/nubo-backend:${TIMESTAMP}
    docker tag ${DOCKER_USERNAME}/nubo-frontend:latest ${DOCKER_USERNAME}/nubo-frontend:${VERSION}
    docker tag ${DOCKER_USERNAME}/nubo-frontend:latest ${DOCKER_USERNAME}/nubo-frontend:${TIMESTAMP}
    
    # Push backend
    echo -e "${GREEN}Pushing backend images...${NC}"
    docker push ${DOCKER_USERNAME}/nubo-backend:latest
    docker push ${DOCKER_USERNAME}/nubo-backend:${VERSION}
    docker push ${DOCKER_USERNAME}/nubo-backend:${TIMESTAMP}
    
    # Push frontend
    echo -e "${GREEN}Pushing frontend images...${NC}"
    docker push ${DOCKER_USERNAME}/nubo-frontend:latest
    docker push ${DOCKER_USERNAME}/nubo-frontend:${VERSION}
    docker push ${DOCKER_USERNAME}/nubo-frontend:${TIMESTAMP}
    
    echo -e "${GREEN}✅ Images successfully pushed to Docker Hub!${NC}"
    echo ""
    echo -e "${GREEN}Available at:${NC}"
    echo -e "  Backend:  docker.io/${DOCKER_USERNAME}/nubo-backend:latest"
    echo -e "  Frontend: docker.io/${DOCKER_USERNAME}/nubo-frontend:latest"
    echo ""
}

# Function to display deployment instructions
show_deployment_instructions() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                 DEPLOYMENT INSTRUCTIONS                    ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}1. ON YOUR SERVER:${NC}"
    echo -e "   Create a directory for Nubo:"
    echo -e "   ${GREEN}mkdir -p /opt/nubo && cd /opt/nubo${NC}"
    echo ""
    echo -e "${YELLOW}2. CREATE ENVIRONMENT FILE:${NC}"
    echo -e "   ${GREEN}nano .env${NC}"
    echo -e "   Add the following (change all values):"
    cat << 'ENVFILE'
# Database
POSTGRES_PASSWORD=your-very-secure-password-here
DATABASE_URL=postgresql://nubo:your-very-secure-password-here@postgres:5432/nubo_email

# Redis
REDIS_PASSWORD=your-redis-password-here

# Security - MUST CHANGE!
JWT_SECRET=generate-a-very-long-random-string-at-least-64-chars
ENCRYPTION_KEY=exactly-32-character-encryption-key

# Application URLs
CORS_ORIGIN=https://your-domain.com
NEXT_PUBLIC_API_URL=https://your-domain.com:5001/api

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ENVFILE
    echo ""
    echo -e "${YELLOW}3. CREATE docker-compose.yml:${NC}"
    echo -e "   ${GREEN}nano docker-compose.yml${NC}"
    echo -e "   Copy the content from docker-compose.prod.yml"
    echo ""
    echo -e "${YELLOW}4. PULL AND RUN:${NC}"
    echo -e "   ${GREEN}docker compose pull${NC}"
    echo -e "   ${GREEN}docker compose up -d${NC}"
    echo ""
    echo -e "${YELLOW}5. CHECK STATUS:${NC}"
    echo -e "   ${GREEN}docker compose ps${NC}"
    echo -e "   ${GREEN}docker compose logs -f${NC}"
    echo ""
    echo -e "${YELLOW}6. ACCESS YOUR INSTANCE:${NC}"
    echo -e "   Frontend: http://your-server:3000"
    echo -e "   Backend:  http://your-server:5001"
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                  PRODUCTION CHECKLIST                      ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ☐ Set up SSL/TLS with nginx or traefik"
    echo -e "  ☐ Configure firewall (allow 80, 443, block others)"
    echo -e "  ☐ Set up domain name and DNS"
    echo -e "  ☐ Configure email SPF/DKIM/DMARC records"
    echo -e "  ☐ Set up automated backups"
    echo -e "  ☐ Configure monitoring (uptime, logs)"
    echo -e "  ☐ Set up CI/CD for updates"
    echo ""
}

# Main menu
echo -e "${YELLOW}What would you like to do?${NC}"
echo "1) Push images to Docker Hub"
echo "2) Show deployment instructions"
echo "3) Both"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        push_images
        ;;
    2)
        show_deployment_instructions
        ;;
    3)
        push_images
        show_deployment_instructions
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}✨ Done! Happy emailing with Nubo!${NC}"
