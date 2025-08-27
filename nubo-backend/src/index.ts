import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import { createClient } from 'redis';
import authRoutes from './routes/auth';
import emailAccountRoutes from './routes/emailAccounts';
import mailRoutes from './routes/mail';
import mailEnhancedRoutes from './routes/mail-enhanced';
import twoFactorRoutes from './routes/two-factor';
import { authenticateToken } from './middleware/auth';
import { BackgroundJobService } from './services/backgroundJobs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://nubo.email',
      'https://www.nubo.email'
    ];
    
    // Also allow any origin from environment variable
    if (process.env.CORS_ORIGIN) {
      allowedOrigins.push(process.env.CORS_ORIGIN);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

// Setup routes
app.use('/api/auth', authRoutes);
app.use('/api/email-accounts', authenticateToken, emailAccountRoutes);
app.use('/api/mail', authenticateToken, mailRoutes);
app.use('/api/mail-v2', authenticateToken, mailEnhancedRoutes); // Enhanced mail routes with caching
app.use('/api/2fa', twoFactorRoutes);

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

// Initialize background jobs
const backgroundJobs = new BackgroundJobService();
backgroundJobs.initialize();

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Nubo backend server running on port ${PORT}`);
  console.log(`📧 Email caching and background sync enabled`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  backgroundJobs.stop();
  process.exit(0);
});