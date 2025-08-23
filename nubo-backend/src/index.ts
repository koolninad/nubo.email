import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import Redis from 'redis';
import helmet from 'helmet';

dotenv.config();

const app = express();
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
  console.log(`Nubo backend server running on port ${PORT}`);
});
