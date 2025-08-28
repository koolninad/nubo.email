import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { pool } from '../config/database';
import { OAuthService } from './oauth.service';
import { PushNotificationService } from './pushNotifications';
import fs from 'fs';
import path from 'path';

export interface EmailAccount {
  id: number;
  user_id: number;
  email: string;
  email_address?: string;
  imap_host: string;
  imap_port: number;
  smtp_host?: string;
  smtp_port?: number;
  username: string;
  password_encrypted: string;
  oauth_account_id?: number;
  auth_type?: string;
}

export class EmailCacheOAuthService {
  private attachmentPath: string;

  constructor() {
    this.attachmentPath = process.env.ATTACHMENT_PATH || '/var/www/nubo/attachments';
    this.ensureAttachmentDirectory();
  }

  private ensureAttachmentDirectory() {
    if (!fs.existsSync(this.attachmentPath)) {
      fs.mkdirSync(this.attachmentPath, { recursive: true });
    }
  }

  /**
   * Get IMAP authentication configuration based on account type
   */
  private async getImapAuth(account: EmailAccount) {
    // Check if this is an OAuth account
    if (account.auth_type === 'OAUTH' && account.oauth_account_id) {
      // Get the access token directly for ImapFlow
      const tokenResult = await pool.query(
        'SELECT access_token, refresh_token, email_address, token_expires_at FROM oauth_accounts WHERE id = $1',
        [account.oauth_account_id]
      );
      
      if (tokenResult.rows.length === 0) {
        throw new Error('OAuth account not found');
      }
      
      let accessToken = tokenResult.rows[0].access_token;
      const email = tokenResult.rows[0].email_address;
      
      // Check if token is expired and refresh if needed
      if (tokenResult.rows[0].token_expires_at) {
        const expiresAt = new Date(tokenResult.rows[0].token_expires_at);
        if (expiresAt <= new Date()) {
          console.log('🔄 Token expired, refreshing...');
          const { OAuthService } = require('./oauth.service');
          accessToken = await OAuthService.refreshAccessToken(account.oauth_account_id);
        }
      }
      
      // Log token details for debugging
      console.log('🔍 OAuth Token Debug:', {
        email,
        tokenLength: accessToken?.length,
        tokenPrefix: accessToken?.substring(0, 10) + '...',
        expiresAt: tokenResult.rows[0].token_expires_at,
        provider: account.auth_type
      });
      
      // ImapFlow handles XOAUTH2 internally when accessToken is provided
      return {
        user: email,
        accessToken: accessToken
      };
    } else {
      // Regular password authentication
      return {
        user: account.username || account.email_address || account.email,
        pass: account.password_encrypted
      };
    }
  }

  /**
   * Sync email headers for a specific folder with OAuth support
   */
  async syncFolderHeaders(account: EmailAccount, folder: string = 'INBOX', limit: number = 500): Promise<{ synced: number; total: number }> {
    console.log(`📥 Syncing ${folder} for account ${account.email || account.email_address} (auth: ${account.auth_type})`);
    
    // Get appropriate auth configuration
    const authConfig = await this.getImapAuth(account);
    console.log(`🔧 Using auth config for ${account.email || account.email_address}:`, {
      user: authConfig.user,
      hasPass: !!authConfig.pass,
      hasAccessToken: !!authConfig.accessToken,
      host: account.imap_host,
      port: account.imap_port
    });
    
    const client = new ImapFlow({
      host: account.imap_host,
      port: account.imap_port,
      secure: account.imap_port === 993,
      auth: authConfig,
      logger: false,
      tls: {
        rejectUnauthorized: false
      }
    });

    try {
      await client.connect();
      console.log(`✅ Connected to IMAP for ${account.email || account.email_address}`);
      
      // Get folder status
      const status = await client.status(folder, { 
        messages: true, 
        uidNext: true,
        uidValidity: true,
        unseen: true
      });

      // Update folder info
      await pool.query(
        `INSERT INTO email_folders (email_account_id, folder_name, folder_type, messages_count, unseen_count, uid_validity, uid_next)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (email_account_id, folder_name) 
         DO UPDATE SET 
           messages_count = EXCLUDED.messages_count,
           unseen_count = EXCLUDED.unseen_count,
           uid_validity = EXCLUDED.uid_validity,
           uid_next = EXCLUDED.uid_next,
           updated_at = CURRENT_TIMESTAMP`,
        [account.id, folder, this.getFolderType(folder), status.messages, status.unseen, status.uidValidity, status.uidNext]
      );

      const lock = await client.getMailboxLock(folder);
      let syncedCount = 0;

      try {
        // Get UIDs to sync
        const existingUids = await this.getExistingUids(account.id, folder);
        console.log(`🔍 Found ${existingUids.size} existing UIDs in ${folder} for account ${account.id}`);
        
        // Fetch recent messages
        let sequence = (status.messages && status.messages > limit) ? `${Math.max(1, status.messages - limit + 1)}:*` : '1:*';
        console.log(`📊 Fetching sequence ${sequence} from ${folder} (total messages: ${status.messages})`);
        
        if (!status.messages || status.messages === 0) {
          console.log(`📭 No messages in ${folder} for ${account.email || account.email_address}`);
          return { synced: 0, total: 0 };
        }

        let messageCount = 0;
        let skippedCount = 0;
        
        for await (let message of client.fetch(sequence, { 
          uid: true,
          flags: true,
          size: true,
          bodyStructure: true,
          envelope: true,
          internalDate: true,
          headers: ['list-unsubscribe']
        })) {
          messageCount++;
          if (messageCount === 1) {
            console.log(`📧 First message UID: ${message.uid}, subject: ${message.envelope?.subject}`);
          }
          
          // Skip if already cached
          if (existingUids.has(message.uid.toString())) {
            skippedCount++;
            continue;
          }

          try {
            // Store the email header
            console.log(`💾 Storing email UID ${message.uid} in ${folder}`);
            const emailId = await this.storeEmailHeader(account, folder, message);
            syncedCount++;
            console.log(`✅ Stored email UID ${message.uid}`);
            
            // Send push notification for new emails (only for INBOX)
            if (folder === 'INBOX' && emailId && message.envelope) {
              try {
                const envelope = message.envelope;
                await PushNotificationService.sendNewEmailNotification(
                  account.user_id.toString(),
                  {
                    id: emailId,
                    subject: envelope.subject || '(No subject)',
                    fromName: envelope.from?.[0]?.name || '',
                    fromAddress: envelope.from?.[0]?.address || 'unknown',
                    accountEmail: account.email || account.email_address || ''
                  }
                );
                console.log(`📱 Push notification sent for new email: ${message.uid}`);
              } catch (pushError) {
                console.error(`❌ Failed to send push notification for email ${message.uid}:`, pushError);
              }
            }
          } catch (error) {
            console.error(`❌ Failed to store email ${message.uid}:`, error);
          }
        }

        console.log(`✅ Synced ${syncedCount} new emails from ${folder} for ${account.email || account.email_address} (checked ${messageCount}, skipped ${skippedCount} existing)`);
        
        // Update sync status
        await pool.query(
          `INSERT INTO email_sync_status (email_account_id, folder_name, last_sync, last_uid)
           VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
           ON CONFLICT (email_account_id, folder_name)
           DO UPDATE SET last_sync = CURRENT_TIMESTAMP, last_uid = EXCLUDED.last_uid`,
          [account.id, folder, (status.uidNext || 1) - 1]
        );

      } finally {
        lock.release();
      }

      await client.logout();
      return { synced: syncedCount, total: status.messages || 0 };

    } catch (error: any) {
      console.error(`❌ Sync failed for ${account.email || account.email_address}:`, error.message);
      console.error(`📍 Error details:`, {
        code: error.code,
        authenticationFailed: error.authenticationFailed,
        response: error.response,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      });
      
      // Check if it's an authentication error
      if (error.message?.includes('AUTHENTICATIONFAILED') || error.message?.includes('Invalid credentials') || error.authenticationFailed) {
        // Try to refresh the OAuth token if it's an OAuth account
        if (account.auth_type === 'OAUTH' && account.oauth_account_id) {
          console.log('🔄 Attempting to refresh OAuth token...');
          try {
            await OAuthService.refreshAccessToken(account.oauth_account_id);
            console.log('✅ Token refreshed, retrying sync...');
            // Retry once with new token
            return await this.syncFolderHeaders(account, folder, limit);
          } catch (refreshError) {
            console.error('❌ Token refresh failed:', refreshError);
          }
        }
      }
      
      throw error;
    }
  }

  /**
   * Get existing UIDs for a folder
   */
  private async getExistingUids(accountId: number, folder: string): Promise<Set<string>> {
    const result = await pool.query(
      'SELECT uid FROM cached_emails WHERE email_account_id = $1 AND folder = $2',
      [accountId, folder]
    );
    return new Set(result.rows.map(r => r.uid));
  }

  /**
   * Determine folder type
   */
  private getFolderType(folderName: string): string {
    const normalized = folderName.toUpperCase();
    if (normalized === 'INBOX') return 'inbox';
    if (normalized.includes('SENT')) return 'sent';
    if (normalized.includes('DRAFT')) return 'drafts';
    if (normalized.includes('TRASH') || normalized.includes('BIN')) return 'trash';
    if (normalized.includes('SPAM') || normalized.includes('JUNK')) return 'spam';
    if (normalized.includes('ARCHIVE')) return 'archive';
    return 'other';
  }

  /**
   * Store email header in cache
   */
  private async storeEmailHeader(account: EmailAccount, folder: string, message: any) {
    const envelope = message.envelope;
    
    // Parse addresses
    const fromAddress = envelope.from?.[0]?.address || 'unknown';
    const fromName = envelope.from?.[0]?.name || fromAddress;
    const toAddresses = this.parseAddresses(envelope.to);
    const ccAddresses = this.parseAddresses(envelope.cc);
    const bccAddresses = this.parseAddresses(envelope.bcc);
    
    // Determine folder flags
    const folderType = this.getFolderType(folder);
    
    const result = await pool.query(
      `INSERT INTO cached_emails (
        email_account_id, uid, folder, subject, from_address, from_name,
        to_addresses, cc_addresses, bcc_addresses, date, message_id,
        is_read, is_starred, is_important, is_flagged, has_attachments,
        size, snippet, is_draft, is_sent, is_trash, is_spam, is_archived
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      ON CONFLICT (email_account_id, uid, folder) DO UPDATE SET
        is_read = EXCLUDED.is_read,
        is_starred = EXCLUDED.is_starred,
        is_flagged = EXCLUDED.is_flagged,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id`,
      [
        account.id,
        message.uid.toString(),
        folder,
        envelope.subject || '(no subject)',
        fromAddress,
        fromName,
        toAddresses,
        ccAddresses,
        bccAddresses,
        envelope.date || new Date(),
        envelope.messageId || `${message.uid}@${account.email || account.email_address}`,
        message.flags.has('\\Seen'),
        message.flags.has('\\Flagged'),
        message.flags.has('\\Flagged'),
        message.flags.has('\\Flagged'),
        this.hasAttachments(message.bodyStructure),
        message.size || 0,
        envelope.subject?.substring(0, 200) || '',
        folderType === 'drafts',
        folderType === 'sent',
        folderType === 'trash',
        folderType === 'spam',
        folderType === 'archive'
      ]
    );
    
    return result.rows[0].id;
  }

  /**
   * Parse email addresses
   */
  private parseAddresses(addresses?: any[]): string {
    if (!addresses || addresses.length === 0) return '';
    return addresses.map(addr => addr.address || '').filter(Boolean).join(', ');
  }

  /**
   * Check if message has attachments
   */
  private hasAttachments(bodyStructure: any): boolean {
    if (!bodyStructure) return false;
    
    const checkPart = (part: any): boolean => {
      if (part.disposition === 'attachment') return true;
      if (part.childNodes) {
        return part.childNodes.some((child: any) => checkPart(child));
      }
      return false;
    };
    
    return checkPart(bodyStructure);
  }

  /**
   * Fetch full email body with OAuth support
   */
  async fetchEmailBody(account: EmailAccount, folder: string, uid: string): Promise<{ text: string; html: string; attachments: Array<{ filename?: string; contentType: string; size?: number }> }> {
    console.log(`📧 Fetching email body for UID ${uid} in ${folder}`);
    
    // First check if body is already cached
    const cachedResult = await pool.query(
      `SELECT text_body, html_body, body_text, body_html FROM cached_emails 
       WHERE email_account_id = $1 AND uid = $2 AND folder = $3`,
      [account.id, uid, folder]
    );
    
    if (cachedResult.rows.length > 0) {
      const cached = cachedResult.rows[0];
      if (cached.text_body || cached.html_body || cached.body_text || cached.body_html) {
        console.log(`📦 Using cached body for UID ${uid}`);
        return {
          text: cached.text_body || cached.body_text || '',
          html: cached.html_body || cached.body_html || '',
          attachments: []
        };
      }
    }
    
    // Get appropriate auth configuration
    const authConfig = await this.getImapAuth(account);
    
    const client = new ImapFlow({
      host: account.imap_host,
      port: account.imap_port,
      secure: account.imap_port === 993,
      auth: authConfig,
      logger: false,
      tls: {
        rejectUnauthorized: false
      }
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock(folder);
      
      try {
        const messages = await client.fetchOne(uid, { 
          source: true,
          uid: true 
        }, { uid: true });
        
        if (!messages || !messages.source) {
          throw new Error('Email not found');
        }

        // Parse the email
        const parsed = await simpleParser(messages.source);
        
        // Store the body in cache
        await pool.query(
          `UPDATE cached_emails 
           SET text_body = $1, html_body = $2, raw_source = $3
           WHERE email_account_id = $4 AND uid = $5 AND folder = $6`,
          [
            parsed.text || '',
            parsed.html || '',
            messages.source.toString(),
            account.id,
            uid,
            folder
          ]
        );

        // Handle attachments
        if (parsed.attachments && parsed.attachments.length > 0) {
          await this.saveAttachments(account.id, uid, parsed.attachments);
        }

        return {
          text: parsed.text || '',
          html: parsed.html || '',
          attachments: parsed.attachments?.map(att => ({
            filename: att.filename,
            contentType: att.contentType,
            size: att.size
          })) || []
        };

      } finally {
        lock.release();
      }
    } catch (error: any) {
      console.error(`Failed to fetch email body:`, error);
      console.error('Auth config used:', { 
        authType: account.auth_type, 
        hasOAuthId: !!account.oauth_account_id,
        folder,
        uid 
      });
      
      // Try token refresh for OAuth accounts
      if (error.message?.includes('AUTHENTICATIONFAILED') && account.auth_type === 'OAUTH' && account.oauth_account_id) {
        console.log('🔄 Attempting to refresh OAuth token...');
        try {
          await OAuthService.refreshAccessToken(account.oauth_account_id);
          console.log('✅ Token refreshed, retrying fetch...');
          return await this.fetchEmailBody(account, folder, uid);
        } catch (refreshError) {
          console.error('❌ Token refresh failed:', refreshError);
        }
      }
      
      throw error;
    } finally {
      await client.logout();
    }
  }

  /**
   * Save attachments
   */
  private async saveAttachments(accountId: number, uid: string, attachments: any[]) {
    const accountDir = path.join(this.attachmentPath, accountId.toString());
    const emailDir = path.join(accountDir, uid);
    
    if (!fs.existsSync(emailDir)) {
      fs.mkdirSync(emailDir, { recursive: true });
    }

    for (const attachment of attachments) {
      const filename = attachment.filename || `attachment_${Date.now()}`;
      const filepath = path.join(emailDir, filename);
      
      fs.writeFileSync(filepath, attachment.content);
      
      await pool.query(
        `INSERT INTO email_attachments (email_id, filename, content_type, size, storage_path)
         SELECT id, $2, $3, $4, $5 FROM cached_emails 
         WHERE email_account_id = $1 AND uid = $6
         ON CONFLICT DO NOTHING`,
        [accountId, filename, attachment.contentType, attachment.size, filepath, uid]
      );
    }
  }
}

// Export singleton instance
export const emailCacheOAuthService = new EmailCacheOAuthService();