#!/bin/bash

# Nubo.email Complete Production Deployment Script
# This script handles the complete deployment process

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
DOCKER_USERNAME="koolninad"
DEPLOYMENT_DIR="/opt/nubo"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        Nubo.email Production Deployment Script v1.0           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}This script must be run as root${NC}"
        exit 1
    fi
}

# Function to install Docker if not present
install_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${YELLOW}Docker not found. Installing Docker...${NC}"
        curl -fsSL https://get.docker.com | sh
        systemctl enable docker
        systemctl start docker
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${YELLOW}Installing Docker Compose...${NC}"
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
}

# Function to setup deployment directory
setup_directory() {
    echo -e "${GREEN}Setting up deployment directory...${NC}"
    mkdir -p ${DEPLOYMENT_DIR}
    cd ${DEPLOYMENT_DIR}
    
    # Create necessary subdirectories
    mkdir -p certbot/www certbot/conf ssl
}

# Function to generate secure passwords
generate_passwords() {
    echo -e "${GREEN}Generating secure passwords...${NC}"
    
    POSTGRES_PASS=$(openssl rand -base64 32)
    REDIS_PASS=$(openssl rand -base64 32)
    JWT_SECRET=$(openssl rand -base64 64)
    ENCRYPTION_KEY=$(openssl rand -base64 24 | cut -c1-32)
    
    echo -e "${YELLOW}Generated passwords (save these securely!):${NC}"
    echo "POSTGRES_PASSWORD: $POSTGRES_PASS"
    echo "REDIS_PASSWORD: $REDIS_PASS"
    echo "JWT_SECRET: $JWT_SECRET"
    echo "ENCRYPTION_KEY: $ENCRYPTION_KEY"
}

# Function to create environment file
create_env_file() {
    echo -e "${GREEN}Creating environment file...${NC}"
    
    read -p "Enter your domain (e.g., nubo.example.com): " DOMAIN
    read -p "Enter your email for SSL certificates: " SSL_EMAIL
    read -p "Enter SMTP host (default: smtp.gmail.com): " SMTP_HOST
    SMTP_HOST=${SMTP_HOST:-smtp.gmail.com}
    read -p "Enter SMTP port (default: 587): " SMTP_PORT
    SMTP_PORT=${SMTP_PORT:-587}
    read -p "Enter SMTP username: " SMTP_USER
    read -sp "Enter SMTP password: " SMTP_PASS
    echo ""
    
    cat > .env << ENVFILE
# Database Configuration
POSTGRES_PASSWORD=${POSTGRES_PASS}
DATABASE_URL=postgresql://nubo:${POSTGRES_PASS}@postgres:5432/nubo_email

# Redis Configuration
REDIS_PASSWORD=${REDIS_PASS}
REDIS_URL=redis://:${REDIS_PASS}@redis:6379

# Security
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Application URLs
CORS_ORIGIN=https://${DOMAIN}
NEXT_PUBLIC_API_URL=https://${DOMAIN}/api

# Email Configuration
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}

# SSL Configuration
SSL_EMAIL=${SSL_EMAIL}
DOMAIN=${DOMAIN}
ENVFILE
    
    chmod 600 .env
    echo -e "${GREEN}Environment file created${NC}"
}

# Function to copy configuration files
copy_configs() {
    echo -e "${GREEN}Copying configuration files...${NC}"
    
    # Copy docker-compose.yml
    cp docker-compose.production.yml docker-compose.yml
    
    # Copy nginx config
    cp nginx.conf nginx.conf
    
    # Copy database init script
    cp init.sql init.sql
    
    echo -e "${GREEN}Configuration files copied${NC}"
}

# Function to generate self-signed SSL certificate (temporary)
generate_temp_ssl() {
    echo -e "${YELLOW}Generating temporary SSL certificate...${NC}"
    
    mkdir -p certbot/conf/live/nubo
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout certbot/conf/live/nubo/privkey.pem \
        -out certbot/conf/live/nubo/fullchain.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=${DOMAIN}"
    
    echo -e "${GREEN}Temporary SSL certificate generated${NC}"
}

# Function to pull Docker images
pull_images() {
    echo -e "${GREEN}Pulling Docker images...${NC}"
    docker-compose pull
}

# Function to start services
start_services() {
    echo -e "${GREEN}Starting services...${NC}"
    docker-compose up -d
    
    echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
    sleep 30
    
    docker-compose ps
}

# Function to setup Let's Encrypt
setup_letsencrypt() {
    echo -e "${GREEN}Setting up Let's Encrypt SSL certificate...${NC}"
    
    # Stop nginx temporarily
    docker-compose stop nginx
    
    # Get certificate
    docker run -it --rm \
        -v ${DEPLOYMENT_DIR}/certbot/www:/var/www/certbot \
        -v ${DEPLOYMENT_DIR}/certbot/conf:/etc/letsencrypt \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email ${SSL_EMAIL} \
        --agree-tos \
        --no-eff-email \
        -d ${DOMAIN}
    
    # Restart nginx
    docker-compose start nginx
    
    echo -e "${GREEN}SSL certificate obtained${NC}"
}

# Function to setup firewall
setup_firewall() {
    echo -e "${GREEN}Setting up firewall...${NC}"
    
    if command -v ufw &> /dev/null; then
        ufw allow 22/tcp
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw --force enable
        echo -e "${GREEN}UFW firewall configured${NC}"
    elif command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-service=ssh
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --reload
        echo -e "${GREEN}Firewalld configured${NC}"
    fi
}

# Function to setup automatic backups
setup_backups() {
    echo -e "${GREEN}Setting up automatic backups...${NC}"
    
    cat > backup.sh << 'BACKUP'
#!/bin/bash
BACKUP_DIR="/opt/nubo/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p ${BACKUP_DIR}

# Backup database
docker exec nubo-postgres pg_dump -U nubo nubo_email | gzip > ${BACKUP_DIR}/db_${DATE}.sql.gz

# Keep only last 7 days of backups
find ${BACKUP_DIR} -name "db_*.sql.gz" -mtime +7 -delete
BACKUP
    
    chmod +x backup.sh
    
    # Add to crontab
    (crontab -l 2>/dev/null; echo "0 2 * * * ${DEPLOYMENT_DIR}/backup.sh") | crontab -
    
    echo -e "${GREEN}Backup script created and scheduled${NC}"
}

# Function to display final information
display_info() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                    Deployment Complete!                       ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}Your Nubo instance is now running!${NC}"
    echo ""
    echo -e "${YELLOW}Access URLs:${NC}"
    echo -e "  Web Interface: https://${DOMAIN}"
    echo -e "  API Endpoint:  https://${DOMAIN}/api"
    echo ""
    echo -e "${YELLOW}Important files:${NC}"
    echo -e "  Environment:   ${DEPLOYMENT_DIR}/.env"
    echo -e "  Docker Compose: ${DEPLOYMENT_DIR}/docker-compose.yml"
    echo -e "  Nginx Config:   ${DEPLOYMENT_DIR}/nginx.conf"
    echo -e "  Backups:       ${DEPLOYMENT_DIR}/backups/"
    echo ""
    echo -e "${YELLOW}Useful commands:${NC}"
    echo -e "  View logs:     docker-compose logs -f"
    echo -e "  Restart:       docker-compose restart"
    echo -e "  Stop:          docker-compose down"
    echo -e "  Update:        docker-compose pull && docker-compose up -d"
    echo ""
    echo -e "${RED}IMPORTANT: Save your passwords securely!${NC}"
    echo ""
}

# Main execution
main() {
    echo -e "${YELLOW}This script will deploy Nubo.email to production${NC}"
    echo -e "${YELLOW}Make sure you have:${NC}"
    echo "  - A domain pointing to this server"
    echo "  - Port 80 and 443 open"
    echo "  - At least 2GB RAM and 10GB disk space"
    echo ""
    read -p "Continue? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    
    check_root
    install_docker
    setup_directory
    generate_passwords
    create_env_file
    copy_configs
    generate_temp_ssl
    pull_images
    start_services
    
    read -p "Setup Let's Encrypt SSL? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        setup_letsencrypt
    fi
    
    setup_firewall
    setup_backups
    display_info
}

# Run main function
main
