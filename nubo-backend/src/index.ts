import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import { createClient } from 'redis';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
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
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.connect().catch(console.error);

// Import routes if they exist
try {
  const authRoutes = require('./routes/auth');
  const emailAccountRoutes = require('./routes/emailAccounts');
  const mailRoutes = require('./routes/mail');
  const twoFactorRoutes = require('./routes/two-factor');
  const { authenticateToken } = require('./middleware/auth');
  
  app.use('/api/auth', authRoutes);
  app.use('/api/email-accounts', authenticateToken, emailAccountRoutes);
  app.use('/api/mail', authenticateToken, mailRoutes);
  app.use('/api/2fa', twoFactorRoutes);
} catch (err) {
  console.log('Routes not yet implemented');
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Basic API route
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Nubo.email Backend API',
    version: '1.0.0'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Nubo backend server running on port ${PORT}`);
});