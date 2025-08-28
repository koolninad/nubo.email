# Nubo Email Client - Project Documentation

## Project Overview
Nubo is a web-based email client with OAuth integration for multiple email providers.

## System Configuration

### Ports
- **Backend**: Port 5000 (not 5001 as in .env)
- **Frontend**: Port 3000
- **Database**: PostgreSQL on port 5433
- **Redis**: Port 6379

### Environment
- **NODE_ENV**: production
- **Database URL**: postgresql://nubo:nubo123@localhost:5433/nubo_email

### Process Management
- **PM2 processes**:
  - nubo-backend (id: 0)
  - nubo-frontend (id: 1)

## Database Schema

### Key Tables
- **users**: User accounts
- **oauth_accounts**: OAuth provider connections
- **cached_emails**: Email storage with columns:
  - `text_body`, `html_body` (consolidated from old `body_text`/`body_html`)
  - `has_attachments` (boolean flag)
- **email_attachments**: Attachment storage (consolidated from old `attachments` table)
- **oauth_states**: OAuth flow state management

### Important Database Notes
- Migrated from duplicate attachment tables
- Consolidated body columns to `text_body`/`html_body`
- All attachment handling uses `email_attachments` table

## API Endpoints

### Main Routes
- **Mail API**: `/api/mail/*` (consolidated, no `/mail-v2`)
- **OAuth API**: `/api/oauth/*`

### OAuth Endpoints
- **Authenticated OAuth**: `/api/oauth/auth/init/:provider` (requires auth token)
- **Welcome OAuth**: `/api/oauth/welcome/auth/init/:provider` (no auth required)
- **OAuth Callback**: `/api/oauth/auth/callback/:provider`
- **Get Providers**: `/api/oauth/providers`
- **User Accounts**: `/api/oauth/accounts`

### Email Endpoints
- **List Emails**: `/api/mail/emails`
- **Get Email**: `/api/mail/emails/:emailId`
- **Email Attachments**: `/api/mail/emails/:emailId/attachments`
- **Download Attachment**: `/api/mail/attachments/:attachmentId/download`

## OAuth Configuration

### Supported Providers
- **Google**: Full OAuth 2.0 with PKCE
- **Yahoo**: OAuth 2.0 (no PKCE support)
- **Microsoft/Outlook**: OAuth 2.0 with PKCE
- **Zoho, Yandex**: Configured but credentials need setup

### OAuth Flow
1. Welcome page uses `/oauth/welcome/auth/init/:provider` (no auth)
2. Authenticated users use `/oauth/auth/init/:provider` (requires auth)
3. Callback handles both flows via user presence check
4. Welcome flow creates new users automatically

### Yahoo OAuth Specifics
- **App ID**: rhn7yNt2
- **No PKCE**: Yahoo doesn't support code challenge
- **Scopes**: 'openid email profile mail-r mail-w'
- **Auth URL**: https://api.login.yahoo.com/oauth2/request_auth
- **Token URL**: https://api.login.yahoo.com/oauth2/get_token

## Frontend Configuration

### Key Pages
- **/welcome**: OAuth provider selection (no auth required)
- **/login**: User authentication
- **/inbox**: Main email interface
- **/settings/accounts**: Account management

### API Client
- Base URL: Uses environment-based API URL
- Authentication: Bearer token in localStorage/sessionStorage

## Development Commands

### Build & Restart
```bash
# Backend
cd /var/www/nubo/nubo-backend && npm run build
pm2 restart nubo-backend

# Frontend  
pm2 restart nubo-frontend
```

### Testing OAuth
```bash
# Test welcome OAuth endpoint (port 5000, not 5001)
curl -X POST "http://localhost:5000/api/oauth/welcome/auth/init/yahoo" \
  -H "Content-Type: application/json" \
  -d '{"redirectUrl": "http://localhost:3000/settings/accounts"}'
```

### Logs
```bash
pm2 logs nubo-backend --lines 20
pm2 logs nubo-frontend --lines 20
```

## Recent Changes

### Route Consolidation
- Moved all mail endpoints from `/mail-v2` to `/mail`
- Cleaned up duplicate database tables and columns
- Updated frontend to use consolidated endpoints

### OAuth Implementation
- Added Yahoo OAuth support
- Created separate welcome page OAuth flow
- Fixed authentication requirements for new user registration

### Database Cleanup
- Migrated `attachments` → `email_attachments`
- Migrated `body_text`/`body_html` → `text_body`/`html_body`
- Updated attachment handling throughout codebase

## Current Issues to Track
- Some email sync errors with IMAP folders (INBOX.DRAFTS, INBOX.SENT)

## Recent Fixes
- ✅ **Yahoo OAuth Welcome Page**: Fixed authentication failure by creating separate `/oauth/welcome/auth/init/:provider` endpoint that doesn't require authentication
- ✅ **Frontend Integration**: Updated welcome page to use correct OAuth endpoint 
- ✅ **API Testing**: Verified Yahoo OAuth endpoint returns proper auth URL
- ✅ **Provider Updates**: Removed Proton Mail and Tutanota, made iCloud Mail preferred
- ✅ **Logo Updates**: Updated Yahoo (SVG), Zoho (PNG), and iCloud (Apple logo) logos
- ✅ **Redirect URI Fix**: Fixed all OAuth provider redirect URIs to use `/api/oauth/auth/callback/:provider`