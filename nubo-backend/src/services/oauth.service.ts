import crypto from 'crypto';
import axios from 'axios';
import { pool } from '../config/database';
import { getProvider, OAuthProvider } from '../config/oauth-providers';
import { generateXOAuth2Token } from '../utils/xoauth2';
import { ProviderOAuthService } from './provider-oauth.service';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}

interface UserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export class OAuthService {
  // Generate state and PKCE parameters for OAuth flow
  static generateAuthParams(): { state: string; codeVerifier: string; codeChallenge: string } {
    const state = crypto.randomBytes(32).toString('base64url');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    return { state, codeVerifier, codeChallenge };
  }

  // Save OAuth state for CSRF protection
  static async saveOAuthState(
    state: string, 
    provider: string, 
    codeVerifier: string,
    userId?: number,
    redirectUrl?: string
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    await pool.query(
      `INSERT INTO oauth_states (state, user_id, provider, code_verifier, redirect_url, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [state, userId || null, provider, codeVerifier, redirectUrl, expiresAt]
    );
  }

  // Verify OAuth state
  static async verifyOAuthState(state: string): Promise<{
    provider: string;
    codeVerifier: string;
    userId?: number;
    redirectUrl?: string;
  } | null> {
    const result = await pool.query(
      `SELECT * FROM oauth_states 
       WHERE state = $1 AND expires_at > NOW()`,
      [state]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    // Delete the state after verification
    await pool.query('DELETE FROM oauth_states WHERE state = $1', [state]);
    
    const row = result.rows[0];
    return {
      provider: row.provider,
      codeVerifier: row.code_verifier,
      userId: row.user_id,
      redirectUrl: row.redirect_url,
    };
  }

  // Build OAuth authorization URL
  static buildAuthUrl(provider: OAuthProvider, state: string, codeChallenge: string): string {
    // Use provider-specific OAuth service
    return ProviderOAuthService.buildAuthUrl(provider, state, codeChallenge);
  }

  // Exchange authorization code for tokens
  static async exchangeCodeForTokens(
    provider: OAuthProvider, 
    code: string, 
    codeVerifier: string
  ): Promise<TokenResponse> {
    // Use provider-specific OAuth service
    return ProviderOAuthService.exchangeCodeForTokens(provider, code, codeVerifier);
  }

  // Get user info from provider
  static async getUserInfo(provider: OAuthProvider, accessToken: string): Promise<UserInfo> {
    // Use provider-specific OAuth service
    return ProviderOAuthService.getUserInfo(provider, accessToken);
  }

  // Save OAuth account to database
  static async saveOAuthAccount(
    userId: number,
    provider: string,
    tokenData: TokenResponse,
    userInfo: UserInfo
  ): Promise<number> {
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;
    
    const result = await pool.query(
      `INSERT INTO oauth_accounts (
        user_id, provider, provider_account_id, email_address, display_name,
        access_token, refresh_token, token_expires_at, scope, auth_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'OAUTH')
      ON CONFLICT (user_id, provider, email_address)
      DO UPDATE SET
        access_token = $6,
        refresh_token = COALESCE($7, oauth_accounts.refresh_token),
        token_expires_at = $8,
        scope = $9,
        updated_at = NOW()
      RETURNING id`,
      [
        userId,
        provider,
        userInfo.id,
        userInfo.email,
        userInfo.name,
        tokenData.access_token,
        tokenData.refresh_token,
        expiresAt,
        tokenData.scope,
      ]
    );
    
    return result.rows[0].id;
  }

  // Refresh access token
  static async refreshAccessToken(accountId: number): Promise<string> {
    const result = await pool.query(
      `SELECT * FROM oauth_accounts WHERE id = $1`,
      [accountId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('OAuth account not found');
    }
    
    const account = result.rows[0];
    const provider = getProvider(account.provider);
    
    if (!provider || !provider.supportedFeatures.refresh) {
      throw new Error('Provider does not support token refresh');
    }
    
    if (!account.refresh_token) {
      throw new Error('No refresh token available');
    }
    
    try {
      // Use provider-specific OAuth service for token refresh
      const tokenData = await ProviderOAuthService.refreshAccessToken(provider, account.refresh_token);
      const expiresAt = tokenData.expires_in 
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : null;
      
      // Update the tokens in database
      await pool.query(
        `UPDATE oauth_accounts 
         SET access_token = $1, 
             refresh_token = COALESCE($2, refresh_token),
             token_expires_at = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [tokenData.access_token, tokenData.refresh_token, expiresAt, accountId]
      );
      
      return tokenData.access_token;
    } catch (error: any) {
      console.error('Token refresh failed:', error.response?.data || error);
      throw new Error('Failed to refresh access token');
    }
  }

  // Get valid access token (refresh if needed)
  static async getValidAccessToken(accountId: number): Promise<string> {
    const result = await pool.query(
      `SELECT * FROM oauth_accounts WHERE id = $1`,
      [accountId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('OAuth account not found');
    }
    
    const account = result.rows[0];
    
    // Check if token is expired
    if (account.token_expires_at && new Date(account.token_expires_at) <= new Date()) {
      // Token is expired, try to refresh
      return await this.refreshAccessToken(accountId);
    }
    
    return account.access_token;
  }

  // Generate XOAUTH2 string for IMAP/SMTP authentication
  static async generateXOAuth2String(accountId: number): Promise<string> {
    const accessToken = await this.getValidAccessToken(accountId);
    
    const result = await pool.query(
      `SELECT email_address FROM oauth_accounts WHERE id = $1`,
      [accountId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('OAuth account not found');
    }
    
    const email = result.rows[0].email_address;
    return generateXOAuth2Token(email, accessToken);
  }

  // Get all OAuth accounts for a user
  static async getUserOAuthAccounts(userId: number): Promise<any[]> {
    const result = await pool.query(
      `SELECT 
        id, provider, email_address, display_name, 
        auth_method, is_active, last_sync_at, created_at,
        CASE 
          WHEN token_expires_at IS NULL THEN 'active'
          WHEN token_expires_at > NOW() THEN 'active'
          WHEN refresh_token IS NOT NULL THEN 'expired'
          ELSE 'invalid'
        END as status
       FROM oauth_accounts 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );
    
    return result.rows;
  }

  // Remove OAuth account
  static async removeOAuthAccount(userId: number, accountId: number): Promise<void> {
    await pool.query(
      `DELETE FROM oauth_accounts 
       WHERE id = $1 AND user_id = $2`,
      [accountId, userId]
    );
  }

  // Clean up expired OAuth states
  static async cleanupExpiredStates(): Promise<void> {
    await pool.query('SELECT cleanup_expired_oauth_states()');
  }
}