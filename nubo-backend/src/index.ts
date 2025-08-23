import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
<<<<<<< HEAD
import pg from 'pg';
import Redis from 'redis';
import helmet from 'helmet';
=======
import authRoutes from './routes/auth';
import emailAccountRoutes from './routes/emailAccounts';
import mailRoutes from './routes/mail';
import twoFactorRoutes from './routes/two-factor';
import { authenticateToken } from './middleware/auth';
>>>>>>> 4c2ebb3 (Initial commit 🚀)

dotenv.config();

const app = express();
<<<<<<< HEAD
const PORT = process.env.PORT || 5001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

// Redis connection
const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.connect().catch(console.error);

// Health check
=======
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/email-accounts', authenticateToken, emailAccountRoutes);
app.use('/api/mail', authenticateToken, mailRoutes);
app.use('/api/2fa', twoFactorRoutes);

>>>>>>> 4c2ebb3 (Initial commit 🚀)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

<<<<<<< HEAD
// Basic API route
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Nubo.email Backend API',
    version: '1.0.0'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Nubo backend server running on port ${PORT}`);
});
=======
app.listen(PORT, () => {
  console.log(`🚀 Nubo backend running on http://localhost:${PORT}`);
});
>>>>>>> 4c2ebb3 (Initial commit 🚀)
