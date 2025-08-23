# Nubo.email - All your inboxes, one place

<<<<<<< HEAD
Nubo is an open-source, ultra-modern webmail client that allows you to manage multiple email accounts in one unified interface.

## 🚀 Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed
- At least 2GB RAM
- 10GB free disk space

### Installation

1. Clone the repository:
```bash
git clone https://github.com/koolninad/nubo.email.git
cd nubo.email
=======
Nubo is an open-source, ultra-modern webmail client. Think of it as the Gmail alternative for 2025 — buttery smooth, minimal, responsive, and elegant.

## Features

- **Universal Nubo Login**: One account to manage all your email accounts
- **Multi-Account Support**: Connect unlimited IMAP/SMTP email accounts
- **Unified Inbox**: View all emails from all accounts in one place
- **Modern UI**: Beautiful, responsive design with dark mode support
- **Fast & Smooth**: Buttery smooth animations and instant search
- **Self-Hostable**: Easy deployment with Docker

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, TailwindCSS, Framer Motion
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **Email**: IMAP (via imapflow) and SMTP (via nodemailer)
- **Deployment**: Docker & Docker Compose

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- PostgreSQL (if running without Docker)
- Node.js 18+ (for development)

### Using Docker (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/yourusername/nubo.git
cd nubo
>>>>>>> 4c2ebb3 (Initial commit 🚀)
```

2. Create environment file:
```bash
cp .env.example .env
<<<<<<< HEAD
# Edit .env with your secure passwords and settings
=======
# Edit .env and set your JWT_SECRET
>>>>>>> 4c2ebb3 (Initial commit 🚀)
```

3. Start the application:
```bash
<<<<<<< HEAD
docker compose up -d
```

4. Access Nubo at http://localhost:3000

### First Time Setup

1. Wait for all services to be healthy:
```bash
docker compose ps
```

2. The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001/api
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## 🛠️ Development Setup

### Frontend Development
```bash
cd nubo-frontend
npm install
npm run dev
```

### Backend Development
```bash
cd nubo-backend
npm install
npm run dev
```

## 📦 Services

- **Frontend**: Next.js 14 with React, TailwindCSS
- **Backend**: Node.js with Express, TypeScript
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Email**: IMAP/SMTP client connections

## 🔒 Security

- All passwords are hashed with bcrypt
- Email credentials encrypted with AES-256
- JWT authentication
- Two-factor authentication support
- SSL/TLS for all connections

## 📄 License

Nubo.email is licensed under the GNU Affero General Public License v3.0 (AGPLv3).

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📧 Support

- Email: support@nubo.email
- GitHub Issues: https://github.com/koolninad/nubo.email/issues

## 🏗️ Project Status

Currently in active development. Core features are working, with more features being added regularly.

---

Made with ❤️ from India
=======
docker-compose up -d
```

4. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001

### Development Setup

1. Install dependencies:
```bash
# Backend
cd nubo-backend
npm install

# Frontend
cd ../nubo-frontend
npm install
```

2. Set up PostgreSQL:
```bash
# Create database and run schema
psql -U postgres
CREATE DATABASE nubo_email;
\c nubo_email
\i nubo-backend/src/db/schema.sql
```

3. Configure environment:
```bash
# Backend
cd nubo-backend
cp .env.example .env
# Edit .env with your database credentials
```

4. Start development servers:
```bash
# Backend (in nubo-backend directory)
npm run dev

# Frontend (in nubo-frontend directory)
npm run dev
```

## Usage

1. **Sign Up**: Create your Nubo account
2. **Add Email Account**: Connect your email accounts using IMAP/SMTP credentials
3. **Sync Emails**: Fetch emails from your connected accounts
4. **Manage Emails**: Read, send, and organize your emails from the unified inbox

### Supported Email Providers

- Gmail (requires app-specific password)
- Outlook/Hotmail
- Yahoo Mail
- Any IMAP/SMTP compatible email service

## Project Structure

```
nubo/
├── nubo-frontend/          # Next.js frontend application
│   ├── app/               # App router pages
│   ├── components/        # React components
│   ├── lib/              # Utilities and API client
│   └── public/           # Static assets
├── nubo-backend/          # Express backend application
│   ├── src/
│   │   ├── routes/       # API routes
│   │   ├── middleware/   # Express middleware
│   │   └── db/          # Database configuration
│   └── dist/            # Compiled TypeScript
├── docker-compose.yml    # Docker orchestration
└── README.md            # This file
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login to account

### Email Accounts
- `GET /api/email-accounts` - List connected accounts
- `POST /api/email-accounts` - Add new email account
- `DELETE /api/email-accounts/:id` - Remove email account

### Mail
- `GET /api/mail/inbox` - Fetch emails
- `POST /api/mail/sync/:accountId` - Sync emails from provider
- `POST /api/mail/send` - Send email
- `PATCH /api/mail/:emailId` - Update email status

## Security Considerations

- Change the default JWT_SECRET in production
- Use environment variables for sensitive data
- Consider encrypting stored email passwords
- Enable HTTPS in production
- Implement rate limiting

## Roadmap

- [ ] Advanced search with filters
- [ ] Labels and folders
- [ ] Email templates
- [ ] Calendar integration
- [ ] Contact management
- [ ] End-to-end encryption
- [ ] Mobile app
- [ ] Offline support

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For issues and questions, please open an issue on GitHub.
>>>>>>> 4c2ebb3 (Initial commit 🚀)
