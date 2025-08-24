# Nubo.email Deployment Guide

## Quick Deploy (with Cloudflare)

### 1. On your server:
```bash
cd /opt/nubo
git pull
./deploy.sh
```

### 2. In Cloudflare:
- Set SSL/TLS mode to **"Flexible"** or **"Full"** (not Full Strict)
- Add DNS records (all proxied through Cloudflare):
  - A record: `nubo.email` → Your server IP
  - A record: `www.nubo.email` → Your server IP  
  - A record: `api.nubo.email` → Your server IP

### 3. Access your site:
- Frontend: https://nubo.email
- API: https://api.nubo.email

## How it Works

### Dynamic API Detection
The frontend automatically detects which API to use based on the current domain:
- On `localhost` → Uses `http://localhost:5001/api`
- On `nubo.email` → Uses `https://api.nubo.email/api`
- On any other domain → Uses `https://api.{domain}/api`

**No hardcoding, no rebuilding needed!**

### Cloudflare Proxy
- Nginx listens on port 80 only
- Cloudflare handles SSL termination
- Real visitor IPs are preserved

## Environment Variables

Create `.env` file with:
```env
POSTGRES_PASSWORD=your-secure-password
REDIS_PASSWORD=your-redis-password
DATABASE_URL=postgresql://nubo:your-secure-password@postgres:5432/nubo_email
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## Troubleshooting

### Clear browser cache
The old localhost:5001 URL might be cached. Clear your browser cache or try incognito mode.

### Check logs
```bash
docker compose logs frontend
docker compose logs backend
docker compose logs nginx
```

### Database conflicts
If you get "Username already exists" errors, reset the database:
```bash
docker compose exec postgres psql -U nubo -d postgres -c "DROP DATABASE nubo_email; CREATE DATABASE nubo_email;"
docker compose exec postgres psql -U nubo -d nubo_email < init.sql
```

## Custom Domains

To use a custom domain:
1. Point your domain and `api.yourdomain.com` to your server
2. The frontend will automatically use `api.yourdomain.com` as the API
3. No code changes needed!