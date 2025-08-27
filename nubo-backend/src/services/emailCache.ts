import { pool } from '../db/pool';
import { ImapFlow, FetchMessageObject } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import * as zlib from 'zlib';
import { promisify } from 'util';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface EmailAccount {
  id: number;
  user_id: number;
  email: string;
  imap_host: string;
  imap_port: number;
  username: string;
  password_encrypted: string;
}

export interface CachedEmail {
  id: number;
  email_account_id: number;
  uid: string;
  message_id: string;
  subject: string;
  from_address: string;
  to_address: string;
  date: Date;
  folder: string;
  snippet: string;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
}

export class EmailCacheService {
  private attachmentBasePath: string;

  constructor() {
    this.attachmentBasePath = process.env.ATTACHMENT_PATH || '/var/www/nubo/attachments';
    this.ensureAttachmentDirectory();
  }

  private async ensureAttachmentDirectory() {
    try {
      await fs.mkdir(this.attachmentBasePath, { recursive: true });
    } catch (error: any) {
      console.error('Failed to create attachment directory:', error);
    }
  }

  /**
   * Sync email headers for a specific folder
   */
  async syncFolderHeaders(account: EmailAccount, folder: string = 'INBOX', limit: number = 500) {
    const client = new ImapFlow({
      host: account.imap_host,
      port: account.imap_port,
      secure: account.imap_port === 993,
      auth: {
        user: account.username,
        pass: account.password_encrypted
      },
      logger: false,
      tls: {
        rejectUnauthorized: false
      }
    });

    try {
      await client.connect();
      
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
        // Get the last synced UID for this folder
        const lastSyncResult = await pool.query(
          `SELECT last_uid_synced FROM email_sync_status 
           WHERE email_account_id = $1 AND folder = $2`,
          [account.id, folder]
        );

        let searchCriteria = 'ALL';
        if (lastSyncResult.rows.length > 0 && lastSyncResult.rows[0].last_uid_synced) {
          // Fetch only new messages since last sync
          searchCriteria = `UID ${lastSyncResult.rows[0].last_uid_synced}:*`;
        }

        // Search for messages
        const messages = await client.search({ uid: searchCriteria } as any);
        const messagesToFetch = (messages as number[]).slice(-limit); // Get last N messages

        if (messagesToFetch.length === 0) {
          console.log(`No new messages to sync in ${folder}`);
          return { synced: 0, total: status.messages };
        }

        // Fetch messages in batches
        const batchSize = 50;
        for (let i = 0; i < messagesToFetch.length; i += batchSize) {
          const batch = messagesToFetch.slice(i, i + batchSize);
          
          for await (const message of client.fetch(batch, {
            uid: true,
            flags: true,
            envelope: true,
            bodyStructure: true,
            headers: ['date', 'from', 'to', 'cc', 'subject', 'message-id', 'in-reply-to', 'references']
          })) {
            await this.saveEmailHeader(account.id, folder, message);
            syncedCount++;
          }
        }

        // Update sync status
        const lastUid = messagesToFetch[messagesToFetch.length - 1];
        await pool.query(
          `INSERT INTO email_sync_status (email_account_id, folder, last_sync_at, last_uid_synced, total_messages, synced_messages)
           VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5)
           ON CONFLICT (email_account_id, folder)
           DO UPDATE SET 
             last_sync_at = CURRENT_TIMESTAMP,
             last_uid_synced = EXCLUDED.last_uid_synced,
             total_messages = EXCLUDED.total_messages,
             synced_messages = email_sync_status.synced_messages + $5,
             updated_at = CURRENT_TIMESTAMP`,
          [account.id, folder, lastUid?.toString(), status.messages, syncedCount]
        );

      } finally {
        lock.release();
      }

      await client.logout();
      return { synced: syncedCount, total: status.messages };

    } catch (error: any) {
      console.error(`Failed to sync folder ${folder}:`, error);
      
      // Log sync error
      await pool.query(
        `UPDATE email_sync_status 
         SET error_message = $1, sync_in_progress = false, updated_at = CURRENT_TIMESTAMP
         WHERE email_account_id = $2 AND folder = $3`,
        [(error as any).message, account.id, folder]
      );
      
      throw error;
    }
  }

  /**
   * Save email header to database
   */
  private async saveEmailHeader(accountId: number, folder: string, message: FetchMessageObject) {
    const envelope = message.envelope;
    if (!envelope) return;

    const hasAttachments = this.checkHasAttachments(message.bodyStructure);
    const snippet = this.generateSnippet(envelope.subject || '', 150);

    try {
      await pool.query(
        `INSERT INTO cached_emails 
         (email_account_id, uid, message_id, subject, from_address, to_address, 
          cc_address, date, folder, snippet, is_read, is_starred, flags,
          in_reply_to, references, thread_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (email_account_id, uid) 
         DO UPDATE SET 
           folder = EXCLUDED.folder,
           is_read = EXCLUDED.is_read,
           flags = EXCLUDED.flags,
           updated_at = CURRENT_TIMESTAMP`,
        [
          accountId,
          message.uid?.toString(),
          envelope.messageId,
          envelope.subject || '(No subject)',
          envelope.from?.[0]?.address || '',
          JSON.stringify(envelope.to || []),
          JSON.stringify(envelope.cc || []),
          envelope.date || new Date(),
          folder,
          snippet,
          message.flags?.has('\\Seen') || false,
          message.flags?.has('\\Flagged') || false,
          Array.from(message.flags || []),
          envelope.inReplyTo,
          Array.isArray((envelope as any).references) ? (envelope as any).references.join(' ') : (envelope as any).references,
          this.generateThreadId(envelope)
        ]
      );
    } catch (error: any) {
      console.error('Failed to save email header:', error);
    }
  }

  /**
   * Fetch and cache email body with compression
   */
  async fetchEmailBody(emailId: number, account: EmailAccount): Promise<{ text: string; html: string }> {
    // First check if we have cached body that hasn't expired
    const cachedResult = await pool.query(
      `SELECT body_text, body_html, body_compressed, body_expires_at 
       FROM cached_emails 
       WHERE id = $1 AND email_account_id = $2`,
      [emailId, account.id]
    );

    if (cachedResult.rows.length === 0) {
      throw new Error('Email not found');
    }

    const cached = cachedResult.rows[0];

    // If we have non-expired body, decompress and return
    if (cached.body_compressed && cached.body_expires_at > new Date()) {
      const decompressed = await gunzip(cached.body_compressed);
      const bodyData = JSON.parse(decompressed.toString());
      return { text: bodyData.text || '', html: bodyData.html || '' };
    }

    // If body is in text fields and not expired, return it
    if ((cached.body_text || cached.body_html) && cached.body_expires_at > new Date()) {
      return { text: cached.body_text || '', html: cached.body_html || '' };
    }

    // Otherwise, fetch from IMAP
    const emailResult = await pool.query(
      'SELECT uid, folder FROM cached_emails WHERE id = $1',
      [emailId]
    );

    if (emailResult.rows.length === 0) {
      throw new Error('Email not found');
    }

    const { uid, folder } = emailResult.rows[0];

    const client = new ImapFlow({
      host: account.imap_host,
      port: account.imap_port,
      secure: account.imap_port === 993,
      auth: {
        user: account.username,
        pass: account.password_encrypted
      },
      logger: false,
      tls: {
        rejectUnauthorized: false
      }
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock(folder || 'INBOX');

      try {
        const messages = client.fetch(uid, { source: true, uid: true });

        for await (const message of messages) {
          if (message.source) {
            const parsed = await simpleParser(message.source);
            
            // Process attachments
            if (parsed.attachments && parsed.attachments.length > 0) {
              await this.saveAttachments(emailId, parsed.attachments);
            }

            const bodyData = {
              text: parsed.text || '',
              html: parsed.html || ''
            };

            // Compress body data
            const compressed = await gzip(JSON.stringify(bodyData));

            // Update database with compressed body
            await pool.query(
              `UPDATE cached_emails 
               SET body_compressed = $1, 
                   body_fetched_at = CURRENT_TIMESTAMP,
                   body_expires_at = CURRENT_TIMESTAMP + INTERVAL '7 days',
                   snippet = $2
               WHERE id = $3`,
              [compressed, this.generateSnippet(parsed.text || '', 200), emailId]
            );

            lock.release();
            await client.logout();
            
            return bodyData;
          }
        }

        throw new Error('Failed to fetch email body');

      } finally {
        lock.release();
      }
    } catch (error: any) {
      console.error('Failed to fetch email body:', error);
      await client.logout();
      throw error;
    }
  }

  /**
   * Save email attachments
   */
  private async saveAttachments(emailId: number, attachments: any[]) {
    for (const attachment of attachments) {
      const checksum = crypto
        .createHash('sha256')
        .update(attachment.content)
        .digest('hex');

      // Generate storage path
      const dateFolder = new Date().toISOString().split('T')[0];
      const storagePath = path.join(
        this.attachmentBasePath,
        dateFolder,
        emailId.toString(),
        `${checksum}_${attachment.filename}`
      );

      // Ensure directory exists
      await fs.mkdir(path.dirname(storagePath), { recursive: true });

      // Save file
      await fs.writeFile(storagePath, attachment.content);

      // Save to database
      await pool.query(
        `INSERT INTO email_attachments 
         (email_id, filename, content_type, size, content_id, is_inline, storage_path, checksum, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP + INTERVAL '7 days')
         ON CONFLICT (email_id, filename, content_id) DO NOTHING`,
        [
          emailId,
          attachment.filename || 'unnamed',
          attachment.contentType,
          attachment.size,
          attachment.contentId,
          attachment.contentDisposition === 'inline',
          storagePath,
          checksum
        ]
      );
    }
  }

  /**
   * Get cached emails with pagination
   */
  async getCachedEmails(
    userId: number, 
    folder: string = 'INBOX', 
    limit: number = 50, 
    offset: number = 0,
    accountId?: number
  ) {
    let query = `
      SELECT ce.*, ea.email as account_email, ea.display_name,
             (SELECT COUNT(*) FROM email_attachments WHERE email_id = ce.id) as attachment_count
      FROM cached_emails ce
      JOIN email_accounts ea ON ce.email_account_id = ea.id
      WHERE ea.user_id = $1 AND ce.folder = $2
    `;
    
    const params: any[] = [userId, folder];

    if (accountId) {
      query += ` AND ea.id = $3`;
      params.push(accountId);
    }

    // Add folder-specific filters
    switch (folder) {
      case 'TRASH':
        query += ` AND ce.is_trash = true`;
        break;
      case 'SPAM':
        query += ` AND ce.is_spam = true`;
        break;
      case 'ARCHIVE':
        query += ` AND ce.is_archived = true`;
        break;
      case 'STARRED':
        query += ` AND ce.is_starred = true`;
        break;
      case 'DRAFTS':
        query += ` AND ce.is_draft = true`;
        break;
      default:
        query += ` AND ce.is_trash = false AND ce.is_spam = false AND ce.is_archived = false`;
    }

    query += ` ORDER BY ce.date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    // Get total count
    let countQuery = query.replace(
      /SELECT.*FROM/s, 
      'SELECT COUNT(*) as total FROM'
    ).replace(/ORDER BY.*$/s, '');
    
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    
    return {
      emails: result.rows,
      total: parseInt(countResult.rows[0]?.total || 0),
      limit,
      offset
    };
  }

  /**
   * Sync all standard folders for an account
   */
  async syncAllFolders(account: EmailAccount) {
    const standardFolders = ['INBOX', 'SENT', 'DRAFTS', 'TRASH', 'SPAM', 'ARCHIVE'];
    const results = [];

    for (const folder of standardFolders) {
      try {
        const result = await this.syncFolderHeaders(account, folder, 100);
        results.push({ folder, ...result });
      } catch (error: any) {
        console.error(`Failed to sync ${folder}:`, error);
        results.push({ folder, error: error.message });
      }
    }

    return results;
  }

  /**
   * Helper methods
   */
  private getFolderType(folder: string): string {
    const folderUpper = folder.toUpperCase();
    if (folderUpper === 'INBOX') return 'INBOX';
    if (folderUpper.includes('SENT')) return 'SENT';
    if (folderUpper.includes('DRAFT')) return 'DRAFTS';
    if (folderUpper.includes('TRASH') || folderUpper.includes('DELETED')) return 'TRASH';
    if (folderUpper.includes('SPAM') || folderUpper.includes('JUNK')) return 'SPAM';
    if (folderUpper.includes('ARCHIVE')) return 'ARCHIVE';
    return 'CUSTOM';
  }

  private generateSnippet(text: string, maxLength: number = 150): string {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    return cleaned.length > maxLength 
      ? cleaned.substring(0, maxLength) + '...'
      : cleaned;
  }

  private generateThreadId(envelope: any): string {
    // Use references or in-reply-to to generate thread ID
    const references = (envelope as any).references;
    if (references && references.length > 0) {
      return crypto
        .createHash('md5')
        .update(references[0])
        .digest('hex');
    }
    
    if (envelope.inReplyTo) {
      return crypto
        .createHash('md5')
        .update(envelope.inReplyTo)
        .digest('hex');
    }

    // Fall back to message ID for new threads
    return crypto
      .createHash('md5')
      .update(envelope.messageId || '')
      .digest('hex');
  }

  private checkHasAttachments(bodyStructure: any): boolean {
    if (!bodyStructure) return false;
    
    const check = (part: any): boolean => {
      if (part.disposition === 'attachment') return true;
      if (part.childNodes) {
        return part.childNodes.some((child: any) => check(child));
      }
      return false;
    };

    return check(bodyStructure);
  }

  /**
   * Cleanup expired email bodies and attachments
   */
  async cleanupExpiredData() {
    try {
      // Clear expired bodies
      await pool.query(
        `UPDATE cached_emails 
         SET body_text = NULL, body_html = NULL, body_compressed = NULL
         WHERE body_expires_at < NOW()`
      );

      // Get expired attachments
      const expiredAttachments = await pool.query(
        `SELECT storage_path FROM email_attachments 
         WHERE expires_at < NOW() AND storage_path IS NOT NULL`
      );

      // Delete files
      for (const attachment of expiredAttachments.rows) {
        try {
          await fs.unlink(attachment.storage_path);
        } catch (error: any) {
          console.error(`Failed to delete attachment: ${attachment.storage_path}`, error);
        }
      }

      // Clear storage paths in database
      await pool.query(
        `UPDATE email_attachments 
         SET storage_path = NULL 
         WHERE expires_at < NOW()`
      );

      console.log('Cleanup completed successfully');
    } catch (error: any) {
      console.error('Cleanup failed:', error);
    }
  }
}