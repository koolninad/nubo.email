import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool';
import { createClient } from 'redis';
import crypto from 'crypto';

interface TokenPayload {
  id: number;
  username: string;
  email: string;
}

interface RefreshTokenData {
  userId: number;
  username: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  deviceInfo?: string;
}

export class AuthService {
  private redis: ReturnType<typeof createClient>;
  private accessTokenExpiry: string = '15m'; // Short-lived access token
  private refreshTokenExpiry: string = '30d'; // Long-lived refresh token
  private rememberMeExpiry: string = '90d'; // Extended refresh token for "remember me"

  constructor() {
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    this.initRedis();
  }

  private async initRedis() {
    try {
      await this.redis.connect();
      console.log('✅ Redis connected for auth service');
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
    }
  }

  /**
   * Generate access token (short-lived)
   */
  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: this.accessTokenExpiry
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token (long-lived)
   */
  async generateRefreshToken(userId: number, rememberMe: boolean = false): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = rememberMe ? this.rememberMeExpiry : this.refreshTokenExpiry;
    
    // Get user details
    const userResult = await pool.query(
      'SELECT username, email FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];
    
    // Calculate expiry time
    const expiryMs = this.parseExpiry(expiry);
    const expiresAt = new Date(Date.now() + expiryMs);

    // Store refresh token in database
    await pool.query(`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at, is_remember_me)
      VALUES ($1, $2, $3, $4)
    `, [userId, this.hashToken(token), expiresAt, rememberMe]);

    // Also store in Redis for fast validation
    const tokenData: RefreshTokenData = {
      userId,
      username: user.username,
      email: user.email,
      createdAt: new Date(),
      expiresAt,
      deviceInfo: ''
    };

    await this.redis.setex(
      `refresh:${token}`,
      Math.floor(expiryMs / 1000),
      JSON.stringify(tokenData)
    );

    return token;
  }

  /**
   * Validate and refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    user: TokenPayload;
  }> {
    // Check Redis first for performance
    const cachedData = await this.redis.get(`refresh:${refreshToken}`);
    
    if (cachedData) {
      const tokenData: RefreshTokenData = JSON.parse(cachedData);
      
      // Check if expired
      if (new Date(tokenData.expiresAt) < new Date()) {
        await this.revokeRefreshToken(refreshToken);
        throw new Error('Refresh token expired');
      }

      // Generate new access token
      const payload: TokenPayload = {
        id: tokenData.userId,
        username: tokenData.username,
        email: tokenData.email
      };

      const accessToken = this.generateAccessToken(payload);

      // Optionally rotate refresh token for enhanced security
      let newRefreshToken: string | undefined;
      if (this.shouldRotateRefreshToken(tokenData)) {
        await this.revokeRefreshToken(refreshToken);
        newRefreshToken = await this.generateRefreshToken(tokenData.userId, false);
      }

      return {
        accessToken,
        refreshToken: newRefreshToken,
        user: payload
      };
    }

    // Fall back to database check
    const result = await pool.query(`
      SELECT rt.*, u.username, u.email, u.is_active
      FROM refresh_tokens rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.token_hash = $1 AND rt.is_valid = true
    `, [this.hashToken(refreshToken)]);

    if (result.rows.length === 0) {
      throw new Error('Invalid refresh token');
    }

    const tokenRecord = result.rows[0];

    // Check if expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      await this.revokeRefreshToken(refreshToken);
      throw new Error('Refresh token expired');
    }

    // Check if user is active
    if (!tokenRecord.is_active) {
      throw new Error('User account is inactive');
    }

    // Generate new access token
    const payload: TokenPayload = {
      id: tokenRecord.user_id,
      username: tokenRecord.username,
      email: tokenRecord.email
    };

    const accessToken = this.generateAccessToken(payload);

    // Update last used timestamp
    await pool.query(
      'UPDATE refresh_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE token_hash = $1',
      [this.hashToken(refreshToken)]
    );

    return {
      accessToken,
      user: payload
    };
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    // Remove from Redis
    await this.redis.del(`refresh:${refreshToken}`);

    // Mark as invalid in database
    await pool.query(
      'UPDATE refresh_tokens SET is_valid = false WHERE token_hash = $1',
      [this.hashToken(refreshToken)]
    );
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: number): Promise<void> {
    // Get all valid tokens for user
    const result = await pool.query(
      'SELECT token_hash FROM refresh_tokens WHERE user_id = $1 AND is_valid = true',
      [userId]
    );

    // Remove from Redis (if we stored the actual token)
    // This is a limitation - we'd need to store token mapping in Redis

    // Mark all as invalid in database
    await pool.query(
      'UPDATE refresh_tokens SET is_valid = false WHERE user_id = $1',
      [userId]
    );
  }

  /**
   * Login user and generate tokens
   */
  async login(
    email: string, 
    password: string, 
    rememberMe: boolean = false,
    deviceInfo?: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: TokenPayload;
  }> {
    // Get user from database
    const result = await pool.query(
      'SELECT id, username, email, password, is_active, failed_login_attempts, locked_until FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = result.rows[0];

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      throw new Error(`Account locked. Try again in ${minutesLeft} minutes`);
    }

    // Check if account is active
    if (!user.is_active) {
      throw new Error('Account is inactive');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      // Increment failed login attempts
      const attempts = user.failed_login_attempts + 1;
      let lockUntil = null;

      // Lock account after 5 failed attempts
      if (attempts >= 5) {
        lockUntil = new Date(Date.now() + 30 * 60000); // Lock for 30 minutes
      }

      await pool.query(
        'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
        [attempts, lockUntil, user.id]
      );

      throw new Error('Invalid credentials');
    }

    // Reset failed login attempts
    await pool.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate tokens
    const payload: TokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = await this.generateRefreshToken(user.id, rememberMe);

    // Log the login
    await pool.query(`
      INSERT INTO login_history (user_id, ip_address, user_agent, login_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    `, [user.id, '', deviceInfo || '']);

    // Trigger background email sync for this user
    const { backgroundEmailSync } = await import('./backgroundEmailSync');
    backgroundEmailSync.syncUserAccounts(user.id);

    return {
      accessToken,
      refreshToken,
      user: payload
    };
  }

  /**
   * Logout user
   */
  async logout(refreshToken: string): Promise<void> {
    await this.revokeRefreshToken(refreshToken);
  }

  /**
   * Verify access token middleware
   */
  async verifyAccessToken(token: string): Promise<TokenPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
        if (err) {
          reject(new Error('Invalid or expired access token'));
        } else {
          resolve(decoded as TokenPayload);
        }
      });
    });
  }

  /**
   * Helper methods
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error('Invalid expiry format');
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: throw new Error('Invalid expiry unit');
    }
  }

  private shouldRotateRefreshToken(tokenData: RefreshTokenData): boolean {
    // Rotate token if it's been used for more than 7 days
    const daysSinceCreated = (Date.now() - new Date(tokenData.createdAt).getTime()) / (24 * 60 * 60 * 1000);
    return daysSinceCreated > 7;
  }

  /**
   * Clean up expired tokens (run periodically)
   */
  async cleanupExpiredTokens(): Promise<void> {
    await pool.query(
      'DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP'
    );
  }
}

// Export singleton instance
export const authService = new AuthService();