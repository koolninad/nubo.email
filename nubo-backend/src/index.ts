import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import emailAccountRoutes from './routes/emailAccounts';
import mailRoutes from './routes/mail';
import twoFactorRoutes from './routes/two-factor';
import { authenticateToken } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/email-accounts', authenticateToken, emailAccountRoutes);
app.use('/api/mail', authenticateToken, mailRoutes);
app.use('/api/2fa', twoFactorRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Nubo backend running on http://localhost:${PORT}`);
});