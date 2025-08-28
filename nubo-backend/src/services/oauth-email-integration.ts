import { pool } from '../config/database';
import { OAuthService } from './oauth.service';
import { getProvider } from '../config/oauth-providers';

export class OAuthEmailIntegration {
  // Create or update email_accounts entry when OAuth account is connected
  static async createEmailAccount(oauthAccountId: number): Promise<number> {
    // Get OAuth account details
    const oauthResult = await pool.query(
      `SELECT * FROM oauth_accounts WHERE id = $1`,
      [oauthAccountId]
    );
    
    if (oauthResult.rows.length === 0) {
      throw new Error('OAuth account not found');
    }
    
    const oauthAccount = oauthResult.rows[0];
    const provider = getProvider(oauthAccount.provider);
    
    if (!provider) {
      throw new Error('Provider configuration not found');
    }
    
    // Determine IMAP/SMTP config based on auth method
    let imapPassword = '';
    let smtpPassword = '';
    
    if (oauthAccount.auth_method === 'OAUTH') {
      // For OAuth, we'll use XOAUTH2
      const xoauth2String = await OAuthService.generateXOAuth2String(oauthAccountId);
      imapPassword = xoauth2String;
      smtpPassword = xoauth2String;
    } else {
      // For app password
      imapPassword = oauthAccount.app_password;
      smtpPassword = oauthAccount.app_password;
    }
    
    // Check if email account already exists
    const existingAccount = await pool.query(
      `SELECT id FROM email_accounts 
       WHERE user_id = $1 AND email_address = $2`,
      [oauthAccount.user_id, oauthAccount.email_address]
    );
    
    if (existingAccount.rows.length > 0) {
      // Update existing account
      const updateResult = await pool.query(
        `UPDATE email_accounts 
         SET imap_host = $1, imap_port = $2, imap_secure = $3,
             imap_username = $4, imap_password = $5,
             smtp_host = $6, smtp_port = $7, smtp_secure = $8,
             smtp_username = $9, smtp_password = $10,
             oauth_account_id = $11, auth_type = $12,
             updated_at = NOW()
         WHERE id = $13
         RETURNING id`,
        [
          provider.imapConfig?.host || '',
          provider.imapConfig?.port || 993,
          provider.imapConfig?.secure !== false,
          oauthAccount.email_address,
          imapPassword,
          provider.smtpConfig?.host || '',
          provider.smtpConfig?.port || 587,
          provider.smtpConfig?.secure !== false,
          oauthAccount.email_address,
          smtpPassword,
          oauthAccountId,
          oauthAccount.auth_method,
          existingAccount.rows[0].id
        ]
      );
      
      return updateResult.rows[0].id;
    } else {
      // Create new email account
      const insertResult = await pool.query(
        `INSERT INTO email_accounts (
          user_id, email, email_address, display_name, username,
          imap_host, imap_port, imap_secure, imap_username, imap_password,
          smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password,
          password_encrypted, oauth_account_id, auth_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING id`,
        [
          oauthAccount.user_id,
          oauthAccount.email_address, // email
          oauthAccount.email_address, // email_address
          oauthAccount.display_name || oauthAccount.email_address, // display_name
          oauthAccount.email_address, // username
          provider.imapConfig?.host || '', // imap_host
          provider.imapConfig?.port || 993, // imap_port
          provider.imapConfig?.secure !== false, // imap_secure
          oauthAccount.email_address, // imap_username
          imapPassword, // imap_password
          provider.smtpConfig?.host || '', // smtp_host
          provider.smtpConfig?.port || 587, // smtp_port
          provider.smtpConfig?.secure !== false, // smtp_secure
          oauthAccount.email_address, // smtp_username
          smtpPassword, // smtp_password
          imapPassword, // password_encrypted
          oauthAccountId, // oauth_account_id
          oauthAccount.auth_method // auth_type
        ]
      );
      
      return insertResult.rows[0].id;
    }
  }
  
  // Update XOAUTH2 token for email account when needed
  static async updateEmailAccountAuth(oauthAccountId: number): Promise<void> {
    const xoauth2String = await OAuthService.generateXOAuth2String(oauthAccountId);
    
    await pool.query(
      `UPDATE email_accounts 
       SET imap_password = $1, smtp_password = $1, updated_at = NOW()
       WHERE oauth_account_id = $2`,
      [xoauth2String, oauthAccountId]
    );
  }
  
  // Get all email accounts that need OAuth token refresh
  static async getAccountsNeedingRefresh(): Promise<any[]> {
    const result = await pool.query(
      `SELECT ea.*, oa.id as oauth_id, oa.token_expires_at 
       FROM email_accounts ea
       JOIN oauth_accounts oa ON ea.oauth_account_id = oa.id
       WHERE ea.auth_type = 'OAUTH' 
         AND oa.refresh_token IS NOT NULL
         AND (oa.token_expires_at IS NULL OR oa.token_expires_at < NOW() + INTERVAL '5 minutes')`
    );
    
    return result.rows;
  }
  
  // Refresh tokens for accounts that need it
  static async refreshExpiredTokens(): Promise<void> {
    const accounts = await this.getAccountsNeedingRefresh();
    
    for (const account of accounts) {
      try {
        await OAuthService.refreshAccessToken(account.oauth_id);
        await this.updateEmailAccountAuth(account.oauth_id);
        console.log(`Refreshed token for account ${account.email_address}`);
      } catch (error) {
        console.error(`Failed to refresh token for account ${account.email_address}:`, error);
      }
    }
  }
}