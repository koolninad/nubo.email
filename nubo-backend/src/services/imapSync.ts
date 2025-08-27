import { ImapFlow } from 'imapflow';
import { pool } from '../db/pool';

export interface EmailAccount {
  id: number;
  email: string;
  imap_host: string;
  imap_port: number;
  username: string;
  password_encrypted: string;
  uid: string;
  folder: string;
}

export class ImapSyncService {
  /**
   * Sync email flags to IMAP server
   */
  async syncEmailFlags(email: EmailAccount, updates: any) {
    const client = new ImapFlow({
      host: email.imap_host,
      port: email.imap_port,
      secure: email.imap_port === 993,
      auth: {
        user: email.username,
        pass: email.password_encrypted
      },
      logger: false,
      tls: {
        rejectUnauthorized: false
      }
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock(email.folder || 'INBOX');

      try {
        const flags = [];
        const removeFlags = [];

        // Map our flags to IMAP flags
        if (updates.is_read === true) flags.push('\\Seen');
        if (updates.is_read === false) removeFlags.push('\\Seen');
        if (updates.is_starred === true) flags.push('\\Flagged');
        if (updates.is_starred === false) removeFlags.push('\\Flagged');

        // Add flags
        if (flags.length > 0) {
          await client.messageFlagsAdd(email.uid, flags, { uid: true });
        }

        // Remove flags
        if (removeFlags.length > 0) {
          await client.messageFlagsRemove(email.uid, removeFlags, { uid: true });
        }

        console.log(`Synced flags for email ${email.uid} in ${email.folder}`);
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (error) {
      console.error('Failed to sync email flags:', error);
      throw error;
    }
  }

  /**
   * Move email to another folder
   */
  async moveEmail(email: EmailAccount, targetFolder: string) {
    const client = new ImapFlow({
      host: email.imap_host,
      port: email.imap_port,
      secure: email.imap_port === 993,
      auth: {
        user: email.username,
        pass: email.password_encrypted
      },
      logger: false,
      tls: {
        rejectUnauthorized: false
      }
    });

    try {
      await client.connect();
      
      // Map common folder names
      const folderMap = await this.getFolderMapping(client, targetFolder);
      const actualTargetFolder = folderMap || targetFolder;

      // Open source folder
      const lock = await client.getMailboxLock(email.folder || 'INBOX');

      try {
        // Move the message
        await client.messageMove(email.uid, actualTargetFolder, { uid: true });
        console.log(`Moved email ${email.uid} from ${email.folder} to ${actualTargetFolder}`);
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (error) {
      console.error('Failed to move email:', error);
      throw error;
    }
  }

  /**
   * Delete email permanently or move to trash
   */
  async deleteEmail(email: EmailAccount, permanent: boolean = false) {
    const client = new ImapFlow({
      host: email.imap_host,
      port: email.imap_port,
      secure: email.imap_port === 993,
      auth: {
        user: email.username,
        pass: email.password_encrypted
      },
      logger: false,
      tls: {
        rejectUnauthorized: false
      }
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock(email.folder || 'INBOX');

      try {
        if (permanent) {
          // Permanently delete
          await client.messageDelete(email.uid, { uid: true });
          console.log(`Permanently deleted email ${email.uid} from ${email.folder}`);
        } else {
          // Move to trash
          const trashFolder = await this.getFolderMapping(client, 'TRASH');
          if (trashFolder) {
            await client.messageMove(email.uid, trashFolder, { uid: true });
            console.log(`Moved email ${email.uid} to trash folder ${trashFolder}`);
          } else {
            // If no trash folder found, mark as deleted
            await client.messageFlagsAdd(email.uid, ['\\Deleted'], { uid: true });
            console.log(`Marked email ${email.uid} as deleted`);
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (error) {
      console.error('Failed to delete email:', error);
      throw error;
    }
  }

  /**
   * Save sent email to IMAP sent folder
   */
  async saveSentEmail(account: EmailAccount, mailOptions: any, messageId: string) {
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
      
      // Find sent folder
      const sentFolder = await this.getFolderMapping(client, 'SENT');
      if (!sentFolder) {
        console.log('No sent folder found, skipping save to IMAP');
        await client.logout();
        return;
      }

      // Construct email message
      const message = this.constructEmailMessage(mailOptions, messageId);
      
      // Append to sent folder
      await client.append(sentFolder, message, ['\\Seen']);
      console.log(`Saved sent email to ${sentFolder}`);

      await client.logout();
    } catch (error) {
      console.error('Failed to save sent email to IMAP:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Get folder mapping for common folder types
   */
  private async getFolderMapping(client: ImapFlow, folderType: string): Promise<string | null> {
    const folderMappings: Record<string, string[]> = {
      'SENT': ['Sent', 'Sent Items', 'Sent Mail', 'INBOX.Sent', '[Gmail]/Sent Mail'],
      'TRASH': ['Trash', 'Deleted', 'Deleted Items', '[Gmail]/Trash', 'INBOX.Trash'],
      'SPAM': ['Spam', 'Junk', 'Junk E-mail', '[Gmail]/Spam', 'INBOX.Spam'],
      'DRAFTS': ['Drafts', '[Gmail]/Drafts', 'INBOX.Drafts'],
      'ARCHIVE': ['Archive', 'All Mail', '[Gmail]/All Mail', 'INBOX.Archive', 'Archives']
    };

    const possibleNames = folderMappings[folderType];
    if (!possibleNames) return folderType;

    // Try to find the folder
    for (const folderName of possibleNames) {
      try {
        await client.status(folderName, { messages: true });
        return folderName;
      } catch (e) {
        // Folder doesn't exist, try next
      }
    }

    return null;
  }

  /**
   * Construct email message for IMAP append
   */
  private constructEmailMessage(mailOptions: any, messageId: string): string {
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const date = new Date().toUTCString();
    
    let message = '';
    message += `Date: ${date}\r\n`;
    message += `From: ${mailOptions.from}\r\n`;
    message += `To: ${mailOptions.to}\r\n`;
    if (mailOptions.cc) message += `Cc: ${mailOptions.cc}\r\n`;
    if (mailOptions.bcc) message += `Bcc: ${mailOptions.bcc}\r\n`;
    message += `Subject: ${mailOptions.subject}\r\n`;
    message += `Message-ID: ${messageId}\r\n`;
    if (mailOptions.inReplyTo) message += `In-Reply-To: ${mailOptions.inReplyTo}\r\n`;
    message += `MIME-Version: 1.0\r\n`;
    
    if (mailOptions.html && mailOptions.text) {
      message += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
      message += `\r\n`;
      
      // Text part
      message += `--${boundary}\r\n`;
      message += `Content-Type: text/plain; charset=utf-8\r\n`;
      message += `Content-Transfer-Encoding: quoted-printable\r\n`;
      message += `\r\n`;
      message += `${mailOptions.text}\r\n`;
      
      // HTML part
      message += `--${boundary}\r\n`;
      message += `Content-Type: text/html; charset=utf-8\r\n`;
      message += `Content-Transfer-Encoding: quoted-printable\r\n`;
      message += `\r\n`;
      message += `${mailOptions.html}\r\n`;
      
      message += `--${boundary}--\r\n`;
    } else if (mailOptions.html) {
      message += `Content-Type: text/html; charset=utf-8\r\n`;
      message += `Content-Transfer-Encoding: quoted-printable\r\n`;
      message += `\r\n`;
      message += `${mailOptions.html}\r\n`;
    } else {
      message += `Content-Type: text/plain; charset=utf-8\r\n`;
      message += `Content-Transfer-Encoding: quoted-printable\r\n`;
      message += `\r\n`;
      message += `${mailOptions.text}\r\n`;
    }
    
    return message;
  }

  /**
   * Batch sync multiple emails
   */
  async batchSyncFlags(accountId: number, emailUpdates: Array<{ uid: string; folder: string; flags: any }>) {
    // Get account details
    const accountResult = await pool.query(
      'SELECT * FROM email_accounts WHERE id = $1',
      [accountId]
    );

    if (accountResult.rows.length === 0) {
      throw new Error('Email account not found');
    }

    const account = accountResult.rows[0];

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

      // Group updates by folder
      const updatesByFolder = emailUpdates.reduce((acc, update) => {
        if (!acc[update.folder]) acc[update.folder] = [];
        acc[update.folder].push(update);
        return acc;
      }, {} as Record<string, typeof emailUpdates>);

      // Process each folder
      for (const [folder, updates] of Object.entries(updatesByFolder)) {
        const lock = await client.getMailboxLock(folder);
        
        try {
          for (const update of updates) {
            const flags = [];
            const removeFlags = [];

            if (update.flags.is_read === true) flags.push('\\Seen');
            if (update.flags.is_read === false) removeFlags.push('\\Seen');
            if (update.flags.is_starred === true) flags.push('\\Flagged');
            if (update.flags.is_starred === false) removeFlags.push('\\Flagged');

            if (flags.length > 0) {
              await client.messageFlagsAdd(update.uid, flags, { uid: true });
            }
            if (removeFlags.length > 0) {
              await client.messageFlagsRemove(update.uid, removeFlags, { uid: true });
            }
          }
        } finally {
          lock.release();
        }
      }

      await client.logout();
      console.log(`Batch synced ${emailUpdates.length} emails`);
    } catch (error) {
      console.error('Failed to batch sync emails:', error);
      throw error;
    }
  }
}