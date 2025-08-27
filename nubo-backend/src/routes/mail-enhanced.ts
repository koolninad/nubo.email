import { Router } from 'express';
import { pool } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { EmailCacheService } from '../services/emailCache';
import { ImapSyncService } from '../services/imapSync';
import { EmailSearchService } from '../services/emailSearch';
import nodemailer from 'nodemailer';

const router = Router();
const emailCache = new EmailCacheService();
const imapSync = new ImapSyncService();
const emailSearch = new EmailSearchService();

/**
 * Get emails from cache with pagination
 */
router.get('/emails', async (req: AuthRequest, res) => {
  const { 
    account_id, 
    folder = 'INBOX', 
    limit = 50, 
    offset = 0,
    search,
    is_unread,
    is_starred,
    has_attachments
  } = req.query;

  try {
    const result = await emailCache.getCachedEmails(
      req.user!.id,
      folder as string,
      parseInt(limit as string),
      parseInt(offset as string),
      account_id ? parseInt(account_id as string) : undefined
    );

    res.json({
      emails: result.emails,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.offset + result.limit < result.total
      }
    });
  } catch (error) {
    console.error('Get emails error:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

/**
 * Get email body (fetches on demand if not cached)
 */
router.get('/emails/:emailId/body', async (req: AuthRequest, res) => {
  const { emailId } = req.params;

  try {
    // Get email and account info
    const emailResult = await pool.query(
      `SELECT ce.*, ea.* 
       FROM cached_emails ce
       JOIN email_accounts ea ON ce.email_account_id = ea.id
       WHERE ce.id = $1 AND ea.user_id = $2`,
      [emailId, req.user!.id]
    );

    if (emailResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const account = emailResult.rows[0];
    const body = await emailCache.fetchEmailBody(parseInt(emailId), account);

    res.json(body);
  } catch (error) {
    console.error('Get email body error:', error);
    res.status(500).json({ error: 'Failed to fetch email body' });
  }
});

/**
 * Get email attachments
 */
router.get('/emails/:emailId/attachments', async (req: AuthRequest, res) => {
  const { emailId } = req.params;

  try {
    // Verify email ownership
    const emailCheck = await pool.query(
      `SELECT ce.id 
       FROM cached_emails ce
       JOIN email_accounts ea ON ce.email_account_id = ea.id
       WHERE ce.id = $1 AND ea.user_id = $2`,
      [emailId, req.user!.id]
    );

    if (emailCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const attachments = await pool.query(
      `SELECT id, filename, content_type, size, content_id, is_inline
       FROM email_attachments
       WHERE email_id = $1`,
      [emailId]
    );

    res.json(attachments.rows);
  } catch (error) {
    console.error('Get attachments error:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

/**
 * Download attachment
 */
router.get('/attachments/:attachmentId/download', async (req: AuthRequest, res) => {
  const { attachmentId } = req.params;

  try {
    const attachmentResult = await pool.query(
      `SELECT ea.*, ce.email_account_id
       FROM email_attachments ea
       JOIN cached_emails ce ON ea.email_id = ce.id
       JOIN email_accounts acc ON ce.email_account_id = acc.id
       WHERE ea.id = $1 AND acc.user_id = $2`,
      [attachmentId, req.user!.id]
    );

    if (attachmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = attachmentResult.rows[0];

    if (!attachment.storage_path) {
      return res.status(404).json({ error: 'Attachment file not found' });
    }

    res.download(attachment.storage_path, attachment.filename);
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
});

/**
 * Sync specific folder
 */
router.post('/sync/folder', async (req: AuthRequest, res) => {
  const { account_id, folder = 'INBOX' } = req.body;

  try {
    const accountResult = await pool.query(
      'SELECT * FROM email_accounts WHERE id = $1 AND user_id = $2',
      [account_id, req.user!.id]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    const account = accountResult.rows[0];

    // Mark sync as in progress
    await pool.query(
      `INSERT INTO email_sync_status (email_account_id, folder, sync_in_progress)
       VALUES ($1, $2, true)
       ON CONFLICT (email_account_id, folder)
       DO UPDATE SET sync_in_progress = true, updated_at = CURRENT_TIMESTAMP`,
      [account_id, folder]
    );

    // Perform sync
    const result = await emailCache.syncFolderHeaders(account, folder);

    // Mark sync as complete
    await pool.query(
      `UPDATE email_sync_status 
       SET sync_in_progress = false, updated_at = CURRENT_TIMESTAMP
       WHERE email_account_id = $1 AND folder = $2`,
      [account_id, folder]
    );

    res.json(result);
  } catch (error) {
    console.error('Sync folder error:', error);
    res.status(500).json({ error: 'Failed to sync folder' });
  }
});

/**
 * Sync all folders for an account
 */
router.post('/sync/all', async (req: AuthRequest, res) => {
  const { account_id } = req.body;

  try {
    const accountResult = await pool.query(
      'SELECT * FROM email_accounts WHERE id = $1 AND user_id = $2',
      [account_id, req.user!.id]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    const account = accountResult.rows[0];

    // Create sync job
    await pool.query(
      `INSERT INTO email_sync_jobs (email_account_id, job_type, status)
       VALUES ($1, 'FULL_SYNC', 'running')`,
      [account_id]
    );

    // Perform sync (in production, this should be done in a background job)
    const results = await emailCache.syncAllFolders(account);

    res.json({ message: 'Sync started', results });
  } catch (error) {
    console.error('Sync all error:', error);
    res.status(500).json({ error: 'Failed to sync folders' });
  }
});

/**
 * Update email flags (mark read, star, archive, etc.)
 */
router.patch('/emails/:emailId', async (req: AuthRequest, res) => {
  const { emailId } = req.params;
  const updates = req.body;

  try {
    // Get email and account info
    const emailResult = await pool.query(
      `SELECT ce.*, ea.* 
       FROM cached_emails ce
       JOIN email_accounts ea ON ce.email_account_id = ea.id
       WHERE ce.id = $1 AND ea.user_id = $2`,
      [emailId, req.user!.id]
    );

    if (emailResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const email = emailResult.rows[0];

    // Update local cache
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 1;

    if (updates.is_read !== undefined) {
      updateFields.push(`is_read = $${paramCount++}`);
      updateValues.push(updates.is_read);
    }
    if (updates.is_starred !== undefined) {
      updateFields.push(`is_starred = $${paramCount++}`);
      updateValues.push(updates.is_starred);
    }
    if (updates.is_archived !== undefined) {
      updateFields.push(`is_archived = $${paramCount++}`);
      updateValues.push(updates.is_archived);
    }
    if (updates.is_spam !== undefined) {
      updateFields.push(`is_spam = $${paramCount++}`);
      updateValues.push(updates.is_spam);
    }
    if (updates.is_trash !== undefined) {
      updateFields.push(`is_trash = $${paramCount++}`);
      updateValues.push(updates.is_trash);
    }

    if (updateFields.length > 0) {
      updateValues.push(emailId);
      await pool.query(
        `UPDATE cached_emails 
         SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${paramCount}`,
        updateValues
      );

      // Sync changes to IMAP server asynchronously
      setImmediate(async () => {
        try {
          await imapSync.syncEmailFlags(email, updates);
        } catch (error) {
          console.error('Failed to sync flags to IMAP:', error);
        }
      });
    }

    res.json({ message: 'Email updated successfully' });
  } catch (error) {
    console.error('Update email error:', error);
    res.status(500).json({ error: 'Failed to update email' });
  }
});

/**
 * Move email to folder
 */
router.post('/emails/:emailId/move', async (req: AuthRequest, res) => {
  const { emailId } = req.params;
  const { targetFolder } = req.body;

  try {
    // Get email and account info
    const emailResult = await pool.query(
      `SELECT ce.*, ea.* 
       FROM cached_emails ce
       JOIN email_accounts ea ON ce.email_account_id = ea.id
       WHERE ce.id = $1 AND ea.user_id = $2`,
      [emailId, req.user!.id]
    );

    if (emailResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const email = emailResult.rows[0];

    // Update local cache
    await pool.query(
      `UPDATE cached_emails 
       SET folder = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [targetFolder, emailId]
    );

    // Sync to IMAP server asynchronously
    setImmediate(async () => {
      try {
        await imapSync.moveEmail(email, targetFolder);
      } catch (error) {
        console.error('Failed to move email on IMAP:', error);
      }
    });

    res.json({ message: 'Email moved successfully' });
  } catch (error) {
    console.error('Move email error:', error);
    res.status(500).json({ error: 'Failed to move email' });
  }
});

/**
 * Delete email
 */
router.delete('/emails/:emailId', async (req: AuthRequest, res) => {
  const { emailId } = req.params;
  const { permanent = false } = req.query;

  try {
    // Get email and account info
    const emailResult = await pool.query(
      `SELECT ce.*, ea.* 
       FROM cached_emails ce
       JOIN email_accounts ea ON ce.email_account_id = ea.id
       WHERE ce.id = $1 AND ea.user_id = $2`,
      [emailId, req.user!.id]
    );

    if (emailResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const email = emailResult.rows[0];

    if (permanent === 'true') {
      // Permanent delete
      await pool.query('DELETE FROM cached_emails WHERE id = $1', [emailId]);
      
      // Delete from IMAP
      setImmediate(async () => {
        try {
          await imapSync.deleteEmail(email, true);
        } catch (error) {
          console.error('Failed to delete email from IMAP:', error);
        }
      });
    } else {
      // Move to trash
      await pool.query(
        `UPDATE cached_emails 
         SET is_trash = true, folder = 'TRASH', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [emailId]
      );

      // Move to trash on IMAP
      setImmediate(async () => {
        try {
          await imapSync.moveEmail(email, 'TRASH');
        } catch (error) {
          console.error('Failed to move email to trash on IMAP:', error);
        }
      });
    }

    res.json({ message: 'Email deleted successfully' });
  } catch (error) {
    console.error('Delete email error:', error);
    res.status(500).json({ error: 'Failed to delete email' });
  }
});

/**
 * Send email
 */
router.post('/send', async (req: AuthRequest, res) => {
  const { account_id, to, cc, bcc, subject, text, html, attachments, reply_to } = req.body;

  try {
    const accountResult = await pool.query(
      'SELECT * FROM email_accounts WHERE id = $1 AND user_id = $2',
      [account_id, req.user!.id]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    const account = accountResult.rows[0];

    const transporter = nodemailer.createTransport({
      host: account.smtp_host,
      port: account.smtp_port,
      secure: account.smtp_port === 465,
      auth: {
        user: account.username,
        pass: account.password_encrypted
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions: any = {
      from: `"${account.display_name}" <${account.email}>`,
      to,
      subject,
      text,
      html
    };

    if (cc) mailOptions.cc = cc;
    if (bcc) mailOptions.bcc = bcc;
    if (reply_to) mailOptions.inReplyTo = reply_to;
    if (attachments) mailOptions.attachments = attachments;

    const info = await transporter.sendMail(mailOptions);

    // Save to sent folder in cache
    await pool.query(
      `INSERT INTO cached_emails 
       (email_account_id, message_id, subject, from_address, to_address, 
        cc_address, date, folder, body_text, body_html, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, 'SENT', $7, $8, true)`,
      [
        account_id,
        info.messageId,
        subject,
        account.email,
        to,
        cc || null,
        text,
        html
      ]
    );

    // Sync to IMAP sent folder asynchronously
    setImmediate(async () => {
      try {
        await imapSync.saveSentEmail(account, mailOptions, info.messageId);
      } catch (error) {
        console.error('Failed to save to sent folder:', error);
      }
    });

    res.json({ 
      message: 'Email sent successfully', 
      messageId: info.messageId 
    });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

/**
 * Get sync status
 */
router.get('/sync/status', async (req: AuthRequest, res) => {
  const { account_id } = req.query;

  try {
    let query = `
      SELECT ss.*, ea.email 
      FROM email_sync_status ss
      JOIN email_accounts ea ON ss.email_account_id = ea.id
      WHERE ea.user_id = $1
    `;
    const params: any[] = [req.user!.id];

    if (account_id) {
      query += ` AND ea.id = $2`;
      params.push(account_id);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

/**
 * Search emails
 */
router.get('/search', async (req: AuthRequest, res) => {
  const { 
    q, 
    account_id, 
    folder, 
    from, 
    to, 
    subject,
    has_attachments,
    is_unread,
    is_starred,
    date_from,
    date_to,
    limit = 50,
    offset = 0
  } = req.query;

  try {
    const searchResult = await emailSearch.search({
      query: q as string || '',
      userId: req.user!.id,
      accountId: account_id ? parseInt(account_id as string) : undefined,
      folder: folder as string,
      from: from as string,
      to: to as string,
      subject: subject as string,
      hasAttachments: has_attachments === 'true',
      isUnread: is_unread === 'true',
      isStarred: is_starred === 'true',
      dateFrom: date_from ? new Date(date_from as string) : undefined,
      dateTo: date_to ? new Date(date_to as string) : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    // Save search query for analytics
    if (q) {
      await emailSearch.saveSearchQuery(req.user!.id, q as string, searchResult.total);
    }

    res.json(searchResult);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search emails' });
  }
});

/**
 * Get search suggestions
 */
router.get('/search/suggestions', async (req: AuthRequest, res) => {
  const { prefix, limit = 10 } = req.query;

  try {
    if (!prefix || (prefix as string).length < 2) {
      return res.json([]);
    }

    const suggestions = await emailSearch.getSuggestions(
      req.user!.id,
      prefix as string,
      parseInt(limit as string)
    );

    res.json(suggestions);
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

/**
 * Get popular searches
 */
router.get('/search/popular', async (req: AuthRequest, res) => {
  try {
    const popular = await emailSearch.getPopularSearches(req.user!.id, 5);
    res.json(popular);
  } catch (error) {
    console.error('Get popular searches error:', error);
    res.status(500).json({ error: 'Failed to get popular searches' });
  }
});

/**
 * Bulk update emails
 */
router.patch('/emails/bulk', async (req: AuthRequest, res) => {
  const { emailIds, updates } = req.body;

  if (!Array.isArray(emailIds) || emailIds.length === 0) {
    return res.status(400).json({ error: 'Email IDs required' });
  }

  try {
    // Verify ownership of all emails
    const verifyResult = await pool.query(
      `SELECT ce.id, ce.uid, ce.folder, ea.*
       FROM cached_emails ce
       JOIN email_accounts ea ON ce.email_account_id = ea.id
       WHERE ce.id = ANY($1) AND ea.user_id = $2`,
      [emailIds, req.user!.id]
    );

    if (verifyResult.rows.length !== emailIds.length) {
      return res.status(403).json({ error: 'Some emails not found or unauthorized' });
    }

    // Update local cache
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 1;

    if (updates.is_read !== undefined) {
      updateFields.push(`is_read = $${paramCount++}`);
      updateValues.push(updates.is_read);
    }
    if (updates.is_starred !== undefined) {
      updateFields.push(`is_starred = $${paramCount++}`);
      updateValues.push(updates.is_starred);
    }
    if (updates.is_archived !== undefined) {
      updateFields.push(`is_archived = $${paramCount++}`);
      updateValues.push(updates.is_archived);
    }
    if (updates.is_spam !== undefined) {
      updateFields.push(`is_spam = $${paramCount++}`);
      updateValues.push(updates.is_spam);
    }
    if (updates.is_trash !== undefined) {
      updateFields.push(`is_trash = $${paramCount++}`);
      updateValues.push(updates.is_trash);
    }

    if (updateFields.length > 0) {
      updateValues.push(emailIds);
      await pool.query(
        `UPDATE cached_emails 
         SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = ANY($${paramCount})`,
        updateValues
      );

      // Sync to IMAP asynchronously
      setImmediate(async () => {
        const emailUpdates = verifyResult.rows.map(email => ({
          uid: email.uid,
          folder: email.folder,
          flags: updates
        }));

        try {
          await imapSync.batchSyncFlags(verifyResult.rows[0].email_account_id, emailUpdates);
        } catch (error) {
          console.error('Failed to sync bulk updates to IMAP:', error);
        }
      });
    }

    res.json({ message: `${emailIds.length} emails updated successfully` });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to update emails' });
  }
});

export default router;