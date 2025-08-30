import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { pool } from '../db/pool';

const router = Router();

// Email transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Check username availability
router.get('/check-username/:username', async (req, res) => {
  const { username } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    
    res.json({ available: result.rows.length === 0 });
  } catch (error) {
    console.error('Username check error:', error);
    res.status(500).json({ error: 'Failed to check username availability' });
  }
});

router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, passwordHash]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.password_hash, u.two_factor_enabled, u.is_admin,
              o.id as organization_id, o.name as organization_name
       FROM users u
       LEFT JOIN organizations o ON u.email = o.contact_email
       WHERE u.username = $1 OR u.email = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // If 2FA is enabled, require 2FA verification
    if (user.two_factor_enabled) {
      return res.status(200).json({
        requiresTwoFactor: true,
        userId: user.id,
        message: '2FA verification required'
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin || false,
        organizationId: user.organization_id,
        organizationName: user.organization_name
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Check if user exists
    const result = await pool.query(
      'SELECT id, username, email FROM users WHERE email = $1',
      [email]
    );

    // Always return success to prevent email enumeration attacks
    if (result.rows.length === 0) {
      return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
    }

    const user = result.rows[0];

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Clean up old reset tokens for this user
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1 OR expires_at < NOW()',
      [user.id]
    );

    // Store reset token
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, email, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, hashedToken, email, expiresAt]
    );

    // Send email if SMTP is configured
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
      
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: email,
        subject: 'Reset your Nubo password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; text-align: center;">Reset Your Password</h2>
            <p>Hi ${user.username},</p>
            <p>You requested to reset your password for your Nubo account. Click the button below to set a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p>This link will expire in 10 minutes for security reasons.</p>
            <p>If you didn't request this reset, please ignore this email. Your password will remain unchanged.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px; text-align: center;">
              This email was sent by <a href="https://nubo.email" style="color: #000;">Nubo.email</a>
            </p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
    }

    res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // Hash the token to match stored version
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid, unused token
    const result = await pool.query(
      `SELECT prt.id, prt.user_id, prt.email, u.username 
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token = $1 
       AND prt.expires_at > NOW() 
       AND prt.used_at IS NULL`,
      [hashedToken]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const resetData = result.rows[0];

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Start transaction
    await pool.query('BEGIN');

    try {
      // Update user password
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [passwordHash, resetData.user_id]
      );

      // Mark token as used
      await pool.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
        [resetData.id]
      );

      // Clean up expired tokens
      await pool.query('DELETE FROM password_reset_tokens WHERE expires_at < NOW()');

      await pool.query('COMMIT');

      res.json({ message: 'Password successfully updated' });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;