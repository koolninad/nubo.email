import { Router } from 'express';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import jwt from 'jsonwebtoken';

const router = Router();

// Generate 2FA secret and QR code
router.post('/setup', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userEmail = req.user!.email;

    // Check if 2FA is already enabled
    const userResult = await pool.query(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows[0]?.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is already enabled for this account' });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Nubo.email (${userEmail})`,
      issuer: 'Nubo.email',
      length: 20,
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    // Store secret (temporarily, until verification)
    await pool.query(
      'UPDATE users SET two_factor_secret = $1 WHERE id = $2',
      [secret.base32, userId]
    );

    res.json({
      secret: secret.base32,
      qrcode: qrCodeUrl,
      otpauth_url: secret.otpauth_url,
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

// Verify and enable 2FA
router.post('/verify-setup', authenticateToken, async (req: AuthRequest, res) => {
  const { token: verificationToken } = req.body;
  
  if (!verificationToken) {
    return res.status(400).json({ error: 'Verification code is required' });
  }

  try {
    const userId = req.user!.id;

    // Get user's 2FA secret
    const userResult = await pool.query(
      'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];
    if (!user || !user.two_factor_secret) {
      return res.status(400).json({ error: 'No 2FA setup found. Please start setup first.' });
    }

    if (user.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: verificationToken,
      window: 2, // Allow 2 time steps before and after current time
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Generate backup codes
    const backupCodes = [];
    const hashedBackupCodes = [];
    
    for (let i = 0; i < 8; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      backupCodes.push(code);
      hashedBackupCodes.push(await bcrypt.hash(code, 10));
    }

    // Enable 2FA
    await pool.query(
      'UPDATE users SET two_factor_enabled = true, two_factor_backup_codes = $1 WHERE id = $2',
      [hashedBackupCodes, userId]
    );

    res.json({
      message: '2FA has been successfully enabled',
      backupCodes, // Show these only once
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ error: 'Failed to verify 2FA setup' });
  }
});

// Verify 2FA code during login
router.post('/verify', async (req, res) => {
  const { userId, token: verificationToken, isBackupCode = false } = req.body;

  if (!userId || !verificationToken) {
    return res.status(400).json({ error: 'User ID and verification code are required' });
  }

  try {
    // Rate limiting check
    const recentAttempts = await pool.query(
      `SELECT COUNT(*) as attempt_count 
       FROM two_factor_attempts 
       WHERE user_id = $1 
       AND attempted_at > NOW() - INTERVAL '15 minutes'
       AND success = false`,
      [userId]
    );

    if (parseInt(recentAttempts.rows[0].attempt_count) >= 5) {
      return res.status(429).json({ 
        error: 'Too many failed attempts. Please try again in 15 minutes.' 
      });
    }

    // Get user's 2FA data
    const userResult = await pool.query(
      'SELECT two_factor_secret, two_factor_enabled, two_factor_backup_codes FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];
    if (!user || !user.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is not enabled for this user' });
    }

    let verified = false;

    if (isBackupCode) {
      // Verify backup code
      const backupCodes = user.two_factor_backup_codes || [];
      for (let i = 0; i < backupCodes.length; i++) {
        if (await bcrypt.compare(verificationToken, backupCodes[i])) {
          verified = true;
          // Remove used backup code
          backupCodes.splice(i, 1);
          await pool.query(
            'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
            [backupCodes, userId]
          );
          break;
        }
      }
    } else {
      // Verify TOTP token
      verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token: verificationToken,
        window: 2,
      });
    }

    // Log attempt
    await pool.query(
      'INSERT INTO two_factor_attempts (user_id, ip_address, success) VALUES ($1, $2, $3)',
      [userId, req.ip, verified]
    );

    if (!verified) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Generate JWT token after successful 2FA verification
    const userResultForToken = await pool.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [userId]
    );

    const userForToken = userResultForToken.rows[0];
    const jwtToken = jwt.sign(
      { id: userForToken.id, username: userForToken.username, email: userForToken.email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      message: '2FA verification successful',
      user: {
        id: userForToken.id,
        username: userForToken.username,
        email: userForToken.email
      },
      token: jwtToken
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ error: 'Failed to verify 2FA code' });
  }
});

// Disable 2FA
router.post('/disable', authenticateToken, async (req: AuthRequest, res) => {
  const { password, token: verificationToken } = req.body;

  if (!password || !verificationToken) {
    return res.status(400).json({ error: 'Password and 2FA code are required' });
  }

  try {
    const userId = req.user!.id;

    // Verify password
    const userResult = await pool.query(
      'SELECT password_hash, two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];
    if (!user || !user.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Verify 2FA token
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: verificationToken,
      window: 2,
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid 2FA code' });
    }

    // Disable 2FA
    await pool.query(
      'UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL, two_factor_backup_codes = NULL WHERE id = $1',
      [userId]
    );

    res.json({ message: '2FA has been disabled successfully' });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

// Get 2FA status
router.get('/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const userResult = await pool.query(
      'SELECT two_factor_enabled, two_factor_backup_codes FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];
    const backupCodesCount = user.two_factor_backup_codes?.length || 0;

    res.json({
      enabled: user.two_factor_enabled || false,
      backupCodesRemaining: backupCodesCount,
    });
  } catch (error) {
    console.error('2FA status error:', error);
    res.status(500).json({ error: 'Failed to get 2FA status' });
  }
});

// Generate new backup codes (requires 2FA verification)
router.post('/backup-codes', authenticateToken, async (req: AuthRequest, res) => {
  const { token: verificationToken } = req.body;

  if (!verificationToken) {
    return res.status(400).json({ error: '2FA code is required' });
  }

  try {
    const userId = req.user!.id;

    // Get user's 2FA data
    const userResult = await pool.query(
      'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];
    if (!user || !user.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    // Verify 2FA token
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: verificationToken,
      window: 2,
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid 2FA code' });
    }

    // Generate new backup codes
    const backupCodes = [];
    const hashedBackupCodes = [];
    
    for (let i = 0; i < 8; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      backupCodes.push(code);
      hashedBackupCodes.push(await bcrypt.hash(code, 10));
    }

    // Update backup codes
    await pool.query(
      'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
      [hashedBackupCodes, userId]
    );

    res.json({
      message: 'New backup codes generated successfully',
      backupCodes, // Show these only once
    });
  } catch (error) {
    console.error('Generate backup codes error:', error);
    res.status(500).json({ error: 'Failed to generate backup codes' });
  }
});

export default router;