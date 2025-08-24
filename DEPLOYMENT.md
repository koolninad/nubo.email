# Nubo.email Production Deployment Guide

## Prerequisites

1. **Server Requirements**
   - Ubuntu 20.04+ or Debian 11+ 
   - Docker and Docker Compose installed
   - Nginx installed
   - Root access
   - Ports 80, 443 open

2. **Domain Configuration**
   - `nubo.email` pointing to your server IP
   - `api.nubo.email` pointing to your server IP
   - Both domains proxied through Cloudflare

## Cloudflare Configuration (IMPORTANT)

### 1. DNS Settings
- Add A record for `nubo.email` → Your server IP (Proxy: ON 🟠)
- Add A record for `api.nubo.email` → Your server IP (Proxy: ON 🟠)
- Add A record for `www.nubo.email` → Your server IP (Proxy: ON 🟠)

### 2. SSL/TLS Settings
- Go to SSL/TLS → Overview
- Set encryption mode to **Full** (NOT Full strict)
- This works with our self-signed certificates

### 3. Page Rules (Optional but Recommended)
- Create rule for `api.nubo.email/*`
  - Cache Level: Bypass
  - Always Use HTTPS: ON

## Deployment Steps

### 1. Build Docker Images Locally

```bash
# Build backend
cd nubo-backend
docker build -t nubo-backend:latest .

# Build frontend  
cd ../nubo-frontend
docker build -t nubo-frontend:latest .

# Save images for transfer
docker save nubo-backend:latest | gzip > nubo-backend.tar.gz
docker save nubo-frontend:latest | gzip > nubo-frontend.tar.gz
```

### 2. Transfer Files to Server

```bash
# Create directory on server
ssh root@your-server "mkdir -p /opt/nubo"

# Copy files
scp nubo-backend.tar.gz nubo-frontend.tar.gz root@your-server:/tmp/
scp deploy.sh init.sql root@your-server:/opt/nubo/
```

### 3. Load Images on Server

```bash
ssh root@your-server
cd /tmp
docker load < nubo-backend.tar.gz
docker load < nubo-frontend.tar.gz
```

### 4. Run Deployment Script

```bash
cd /opt/nubo
chmod +x deploy.sh
./deploy.sh
```

The script will:
- Generate self-signed SSL certificates
- Configure nginx for both domains
- Set up Docker containers
- Create necessary environment files

### 5. Configure SMTP (Required for Password Reset)

Edit `/opt/nubo/.env` and add your SMTP credentials:

```env
# For Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
```

Then restart backend:
```bash
cd /opt/nubo
docker-compose restart backend
```

## How It Works

### API URL Detection
The frontend automatically detects the correct API URL:
- On `localhost` → `http://localhost:5001`
- On `nubo.email` → `https://api.nubo.email`
- On custom domains → `https://api.{domain}`

**No hardcoding or rebuilding needed!**

### SSL with Cloudflare
- Self-signed certificates on server (for Cloudflare Full mode)
- Cloudflare handles public SSL certificates
- Nginx terminates SSL from Cloudflare
- All traffic between Cloudflare and server is encrypted

## Verification

### 1. Check SSL Certificate
```bash
# Should show your self-signed certificate
openssl s_client -connect localhost:443 -servername nubo.email < /dev/null
```

### 2. Check Services
```bash
# Frontend (should return 200)
curl -I https://nubo.email

# API Health (should return {"status":"ok"})
curl https://api.nubo.email/health
```

### 3. Check Container Status
```bash
cd /opt/nubo
docker-compose ps
docker-compose logs --tail=50
```

## Troubleshooting

### SSL Issues

**Error 525: SSL Handshake Failed**
- Ensure Cloudflare SSL mode is "Full" (not Full strict)
- Check nginx: `systemctl status nginx`
- Check certificates: `ls -la /etc/nginx/ssl/`
- Restart nginx: `systemctl restart nginx`

**Error 521: Web Server Is Down**
- Check nginx: `systemctl restart nginx`
- Check firewall: `ufw status`
- Ensure ports are open: `ufw allow 443/tcp`

### API Connection Issues

**CORS Errors**
- Backend handles CORS (nginx shouldn't add CORS headers)
- Check backend logs: `docker-compose logs backend`
- Verify CORS_ORIGIN in .env matches frontend URL

**404 on API Calls**
- API endpoints are at `https://api.nubo.email/auth/login` (no /api prefix)
- Frontend calls should use `https://api.nubo.email` as base URL
- Check nginx config: `nginx -t`

### Container Issues
```bash
# Restart all services
cd /opt/nubo
docker-compose restart

# View specific logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# Rebuild containers
docker-compose down
docker-compose up -d
```

### Database Issues
```bash
# Connect to database
docker exec -it nubo-postgres psql -U nubo -d nubo

# Check tables
\dt

# Check users table
SELECT id, username, email FROM users;

# Exit
\q

# Reset database if needed
docker-compose down
docker volume rm nubo_postgres_data
docker-compose up -d
```

## Security Best Practices

### 1. Firewall Setup
```bash
# Configure UFW
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw --force enable
```

### 2. Secure Files
```bash
# Protect environment file
chmod 600 /opt/nubo/.env

# Protect SSL certificates
chmod 600 /etc/nginx/ssl/privkey.pem
chmod 644 /etc/nginx/ssl/fullchain.pem
```

### 3. Regular Updates
```bash
# System updates
apt update && apt upgrade -y

# Docker cleanup
docker system prune -af --volumes

# Check disk space
df -h
```

## Monitoring

### Health Check Script
```bash
#!/bin/bash
# Save as /opt/nubo/health-check.sh

echo "=== Nubo Health Check ==="
echo ""

# Check containers
echo "Container Status:"
docker-compose ps

echo ""
echo "Endpoint Status:"
curl -s -o /dev/null -w "Frontend: %{http_code}\n" https://nubo.email
curl -s -o /dev/null -w "API: %{http_code}\n" https://api.nubo.email/health

echo ""
echo "System Resources:"
df -h | grep -E "^/dev/" | head -3
free -h | grep -E "^Mem:"
```

### Log Monitoring
```bash
# Combined logs
docker-compose logs --tail=100 --follow

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## Backup & Restore

### Database Backup
```bash
# Create backup
docker exec nubo-postgres pg_dump -U nubo nubo > backup_$(date +%Y%m%d).sql

# Restore from backup
docker exec -i nubo-postgres psql -U nubo nubo < backup_20240824.sql
```

### Full Application Backup
```bash
# Backup everything
tar -czf nubo_backup_$(date +%Y%m%d).tar.gz \
  /opt/nubo/.env \
  /opt/nubo/docker-compose.yml \
  /etc/nginx/sites-available/nubo.conf \
  /etc/nginx/ssl/
```

## Updates

To update the application:

1. **Build new images locally**
```bash
cd nubo-backend && docker build -t nubo-backend:latest .
cd ../nubo-frontend && docker build -t nubo-frontend:latest .
```

2. **Save and transfer**
```bash
docker save nubo-backend:latest | gzip > nubo-backend.tar.gz
docker save nubo-frontend:latest | gzip > nubo-frontend.tar.gz
scp *.tar.gz root@server:/tmp/
```

3. **Load and restart on server**
```bash
ssh root@server
cd /tmp && docker load < nubo-backend.tar.gz && docker load < nubo-frontend.tar.gz
cd /opt/nubo && docker-compose up -d
```

## Custom Domain Setup

To use your own domain:

1. **DNS Setup** (in your DNS provider)
   - A record: `yourdomain.com` → Server IP
   - A record: `api.yourdomain.com` → Server IP

2. **Update nginx** (add to `/etc/nginx/sites-available/nubo.conf`)
   - Add your domain to server_name directives
   - Reload nginx: `systemctl reload nginx`

3. **Update .env**
   - Set `CORS_ORIGIN=https://yourdomain.com`
   - Restart backend: `docker-compose restart backend`

The frontend will automatically detect and use `api.yourdomain.com`!

## Important Notes

⚠️ **Cloudflare SSL Mode**: MUST be set to "Full" (not Full strict)
⚠️ **API URL**: The API is at `api.nubo.email` (no /api prefix in domain)
⚠️ **CORS**: Handled by backend only (nginx doesn't add CORS headers)
⚠️ **Ports**: Containers listen on localhost only, nginx handles external traffic

## Support & Debugging

```bash
# Quick diagnosis
cd /opt/nubo
./deploy.sh --check  # Run health checks

# Check all logs
docker-compose logs | less

# Test endpoints locally
curl -v http://localhost:3000  # Frontend
curl -v http://localhost:5000/health  # Backend

# Check nginx
nginx -t  # Test config
nginx -T  # Show full config
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Username already exists" | User already registered, use different username |
| "Failed to fetch" | Check CORS settings, ensure API URL is correct |
| SSL errors in browser | Clear browser cache, check Cloudflare SSL mode |
| 502 Bad Gateway | Containers not running, check `docker-compose ps` |
| Container keeps restarting | Check logs: `docker-compose logs [service]` |
| Can't send emails | Configure SMTP settings in .env file |

---

**Need help?** Check the logs first: `docker-compose logs --tail=100`