# Nubo.email - All your inboxes, one place

Nubo is an open-source, ultra-modern webmail client that allows you to manage multiple email accounts in one unified interface.

## 🚀 Features

- **Universal Nubo Login**: One account to manage all your email accounts
- **Multi-Account Support**: Connect unlimited IMAP/SMTP email accounts  
- **Unified Inbox**: View all emails from all accounts in one place
- **Modern UI**: Beautiful, responsive design with dark mode support
- **Fast & Smooth**: Buttery smooth animations and instant search
- **2FA Security**: Two-factor authentication support
- **Self-Hostable**: Easy deployment with Docker

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, TailwindCSS, Framer Motion
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Email**: IMAP (via imapflow) and SMTP (via nodemailer)
- **Deployment**: Docker & Docker Compose

## 📦 Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed
- At least 2GB RAM
- 10GB free disk space

### Installation

1. Clone the repository:
```bash
git clone https://github.com/koolninad/nubo.email.git
cd nubo.email
```

2. Create environment file:
```bash
cp .env.example .env
# Edit .env with your secure passwords and settings
```

3. Start the application:
```bash
docker compose up -d
```

4. Access Nubo at http://localhost:3000

## 🔧 Development Setup

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

## 📊 Services

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5001/api
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

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