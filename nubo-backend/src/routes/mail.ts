import { Router } from 'express';
import { pool } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import { 
  cacheEmailBody, 
  getCachedEmailBody, 
  cacheEmailList, 
  getCachedEmailList,
  clearUserCache 
} from '../db/redis';

const router = Router();

router.get('/inbox', async (req: AuthRequest, res) => {
  const { account_id, limit = 50, offset = 0 } = req.query;

  try {
    let query: string;
    let params: any[];

    if (account_id) {
      query = `
        SELECT ce.*, ea.email as account_email 
        FROM cached_emails ce
        JOIN email_accounts ea ON ce.email_account_id = ea.id
        WHERE ea.user_id = $1 AND ea.id = $2 AND NOT ce.is_deleted
        ORDER BY ce.date DESC
        LIMIT $3 OFFSET $4
      `;
      params = [req.user!.id, account_id, limit, offset];
    } else {
      query = `
        SELECT ce.*, ea.email as account_email 
        FROM cached_emails ce
        JOIN email_accounts ea ON ce.email_account_id = ea.id
        WHERE ea.user_id = $1 AND NOT ce.is_deleted
        ORDER BY ce.date DESC
        LIMIT $2 OFFSET $3
      `;
      params = [req.user!.id, limit, offset];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get inbox error:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

// Fetch email body on demand
router.get('/email/:emailId/body', async (req: AuthRequest, res) => {
  const { emailId } = req.params;

  try {
    // First check if we have the body cached
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

    // If we already have the body, return it
    if (email.body_text || email.body_html) {
      return res.json({
        text_body: email.body_text,
        html_body: email.body_html
      });
    }

    // Otherwise, fetch it from IMAP
    const isSecure = email.imap_port === 993;
    
    const client = new ImapFlow({
      host: email.imap_host,
      port: email.imap_port,
      secure: isSecure,
      auth: {
        user: email.username,
        pass: email.password_encrypted
      },
      logger: false,
      tls: {
        rejectUnauthorized: false
      }
    });

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      // Fetch the specific email by UID
      const messages = client.fetch(email.uid, { 
        source: true,
        uid: true
      });

      for await (const message of messages) {
        if (message.source) {
          const parsed = await simpleParser(message.source);
          const textBody = parsed.text || '';
          const htmlBody = parsed.html || '';

          // Update the database with the body
          await pool.query(
            'UPDATE cached_emails SET body_text = $1, body_html = $2 WHERE id = $3',
            [textBody, htmlBody, emailId]
          );

          lock.release();
          await client.logout();
          
          return res.json({
            text_body: textBody,
            html_body: htmlBody
          });
        }
      }
    } catch (fetchError) {
      console.error('Failed to fetch email body:', fetchError);
      lock.release();
      await client.logout();
      
      // Return empty body if fetch fails
      return res.json({
        text_body: 'Unable to fetch email body',
        html_body: '<p>Unable to fetch email body</p>'
      });
    }
  } catch (error) {
    console.error('Get email body error:', error);
    res.status(500).json({ error: 'Failed to fetch email body' });
  }
});

router.post('/sync/:accountId', async (req: AuthRequest, res) => {
  const { accountId } = req.params;
  const { folder = 'INBOX' } = req.body || {}; // Allow syncing different folders

  try {
    const accountResult = await pool.query(
      'SELECT * FROM email_accounts WHERE id = $1 AND user_id = $2',
      [accountId, req.user!.id]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    const account = accountResult.rows[0];

    const isSecure = account.imap_port === 993;
    
    const client = new ImapFlow({
      host: account.imap_host,
      port: account.imap_port,
      secure: isSecure,
      auth: {
        user: account.username,
        pass: account.password_encrypted
      },
      logger: false,
      tls: {
        rejectUnauthorized: false
      }
    });

    await client.connect();
    
    // Map folder types to common IMAP folder names
    let folderToSync = folder;
    const folderMappings: Record<string, string[]> = {
      'SENT': ['Sent', 'Sent Items', 'Sent Mail', 'INBOX.Sent', '[Gmail]/Sent Mail'],
      'SPAM': ['Spam', 'Junk', 'Junk E-mail', '[Gmail]/Spam', 'INBOX.Spam'],
      'TRASH': ['Trash', 'Deleted', 'Deleted Items', '[Gmail]/Trash', 'INBOX.Trash'],
      'DRAFTS': ['Drafts', '[Gmail]/Drafts', 'INBOX.Drafts']
    };
    
    if (folderMappings[folder]) {
      // Try common folder names for the requested type
      let folderFound = false;
      for (const folderName of folderMappings[folder]) {
        try {
          await client.status(folderName, { messages: true });
          folderToSync = folderName;
          console.log(`Found ${folder} folder as: ${folderName}`);
          folderFound = true;
          break;
        } catch (e) {
          // Try next folder name
        }
      }
      
      // If folder not found, return gracefully
      if (!folderFound) {
        console.log(`${folder} folder not found on this email account`);
        await client.logout();
        return res.json({ 
          message: `${folder} folder not found`, 
          synced: 0 
        });
      }
    }
    
    // Check if folder exists before trying to lock
    try {
      await client.status(folderToSync, { messages: true });
    } catch (error) {
      console.log(`Folder ${folderToSync} does not exist`);
      await client.logout();
      return res.json({ 
        message: `Folder ${folderToSync} not found`, 
        synced: 0 
      });
    }
    
    const lock = await client.getMailboxLock(folderToSync);
    let syncedCount = 0;

    try {
      // Get the most recent emails for faster sync
      let messageList: any = [];
      try {
        // Try to get UIDs first
        const status = await client.status(folderToSync, { messages: true, uidNext: true });
        const totalMessages = status.messages || 0;
        
        if (totalMessages > 0) {
          // Get the last 10 messages for quick sync
          const startSeq = Math.max(1, totalMessages - 9);
          messageList = `${startSeq}:*`;
        } else {
          console.log('No messages in mailbox');
          lock.release();
          await client.logout();
          return res.json({ message: 'No messages to sync' });
        }
      } catch (searchError) {
        console.error('Status check failed, using fallback:', searchError);
        // Fallback to fetching last 10
        messageList = '*:10';
      }
      
      if (!messageList || (Array.isArray(messageList) && messageList.length === 0)) {
        console.log('No messages to sync');
        lock.release();
        await client.logout();
        return res.json({ message: 'No messages to sync' });
      }
      
      for await (const message of client.fetch(messageList, { 
        envelope: true, 
        uid: true,
        flags: true
      })) {
        const envelope = message.envelope;
        const uid = message.uid.toString();

        const existingEmail = await pool.query(
          'SELECT id FROM cached_emails WHERE email_account_id = $1 AND uid = $2',
          [accountId, uid]
        );

        if (existingEmail.rows.length === 0 && envelope) {
          // For now, we'll just store the envelope data without body
          // Body fetching can be done on-demand when email is opened
          const textBody = '';
          const htmlBody = '';
          const snippet = envelope.subject || 'No preview available';

          // Determine folder-specific flags
          const folderFlags: any = {
            folder: folderToSync,
            is_draft: folder === 'DRAFTS',
            is_spam: folder === 'SPAM',
            is_trash: folder === 'TRASH'
          };

          await pool.query(
            `INSERT INTO cached_emails 
            (email_account_id, uid, message_id, subject, from_address, 
             to_address, date, body_text, body_html, is_read,
             is_draft, is_spam, is_trash) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (email_account_id, uid) 
            DO UPDATE SET 
              is_draft = EXCLUDED.is_draft,
              is_spam = EXCLUDED.is_spam,
              is_trash = EXCLUDED.is_trash`,
            [
              accountId,
              uid,
              envelope.messageId || null,
              envelope.subject || '(No subject)',
              envelope.from?.[0]?.address || '',
              JSON.stringify(envelope.to || []),
              envelope.date || new Date(),
              textBody,
              htmlBody,
              message.flags?.has('\\Seen') || false,
              folderFlags.is_draft,
              folderFlags.is_spam,
              folderFlags.is_trash
            ]
          );
          syncedCount++;
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    res.json({ message: `Synced ${syncedCount} new emails from ${folderToSync}` });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync emails' });
  }
});

router.post('/send', async (req: AuthRequest, res) => {
  const { account_id, to, subject, text, html, cc, bcc } = req.body;

  console.log('Send email request received:', {
    account_id,
    to,
    subject,
    hasText: !!text,
    hasHtml: !!html,
    cc,
    bcc,
    bodyKeys: Object.keys(req.body)
  });

  if (!account_id || !to || !subject || (!text && !html)) {
    console.error('Send email validation failed:', {
      hasAccountId: !!account_id,
      hasTo: !!to,
      hasSubject: !!subject,
      hasText: !!text,
      hasHtml: !!html
    });
    return res.status(400).json({ 
      error: 'Missing required fields',
      details: {
        account_id: !account_id ? 'Account ID is required' : null,
        to: !to ? 'Recipient is required' : null,
        subject: !subject ? 'Subject is required' : null,
        body: (!text && !html) ? 'Email body is required' : null
      }
    });
  }

  let account: any; // Declare account in outer scope for error handling
  
  try {
    const accountResult = await pool.query(
      'SELECT * FROM email_accounts WHERE id = $1 AND user_id = $2',
      [account_id, req.user!.id]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    account = accountResult.rows[0];

    // Determine security settings for SMTP
    const smtpPort = parseInt(account.smtp_port);
    const isSecure = smtpPort === 465;
    
    console.log('SMTP Configuration:', {
      host: account.smtp_host,
      port: smtpPort,
      secure: isSecure,
      user: account.username,
      from: account.email
    });
    
    const transporter = nodemailer.createTransport({
      host: account.smtp_host,
      port: smtpPort,
      secure: isSecure, // true for 465, false for other ports
      auth: {
        user: account.username,
        pass: account.password_encrypted
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      },
      requireTLS: smtpPort === 587, // Force STARTTLS for port 587
      debug: true, // Enable debug output
      logger: true // Log to console
    });

    // Test connection first
    console.log('Testing SMTP connection...');
    await transporter.verify();
    console.log('SMTP connection verified successfully');
    
    const mailOptions: any = {
      from: `"${account.display_name}" <${account.email}>`,
      to,
      subject,
      text,
      html,
      // Add message ID header for better tracking
      messageId: `<${Date.now()}@${account.email.split('@')[1]}>`,
      headers: {
        'X-Mailer': 'Nubo Email Client'
      }
    };

    // Add CC and BCC if provided
    if (cc) mailOptions.cc = cc;
    if (bcc) mailOptions.bcc = bcc;
    
    console.log('Sending email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      host: account.smtp_host,
      port: account.smtp_port
    });
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully:', { 
      messageId: info.messageId, 
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected,
      envelope: info.envelope 
    });
    
    res.json({ 
      message: 'Email sent successfully', 
      messageId: info.messageId,
      accepted: info.accepted 
    });
  } catch (error: any) {
    console.error('Send email error:', error);
    console.error('Error details:', {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      message: error.message
    });
    
    // More detailed error handling
    if (error.code === 'EAUTH' || error.responseCode === 535 || error.responseCode === 530) {
      res.status(400).json({ 
        error: 'Authentication failed. Please check your SMTP username and password. You may need to use an app-specific password for Gmail/Yahoo/Outlook.' 
      });
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      res.status(400).json({ 
        error: 'Failed to connect to SMTP server. Please check your server host and port settings.' 
      });
    } else if (error.message?.includes('IP address different location')) {
      res.status(403).json({
        error: 'Email blocked due to IP location security',
        details: 'Your email provider (CT Mail) has blocked sending from this server because it\'s in a different location than your usual login.',
        solutions: [
          '1. Use an app-specific password if CT Mail provides this option',
          '2. Contact CT Mail support to whitelist this server\'s IP address',
          '3. Access your email account from this server\'s location once to "train" the system',
          '4. Use a VPN to match your usual location',
          '5. Consider using an email relay service like SendGrid for sending'
        ],
        technicalInfo: {
          errorMessage: error.message,
          serverLocation: 'VPS/Cloud Server',
          issue: 'Geographic IP restriction'
        }
      });
    } else if (error.responseCode === 554 || error.message?.includes('relay')) {
      res.status(400).json({ 
        error: 'Email rejected by server. The recipient address may be blocked or the server may not allow relaying.' 
      });
    } else if (error.code === 'ESOCKET' || error.code === 'ECONNREFUSED') {
      res.status(400).json({ 
        error: `Cannot connect to SMTP server. Please verify the server settings.` 
      });
    } else if (error.message?.includes('self signed certificate')) {
      res.status(400).json({ 
        error: 'SSL certificate issue. The server may be using a self-signed certificate.' 
      });
    } else {
      res.status(500).json({ 
        error: `Failed to send email: ${error.response || error.message || 'Unknown error'}` 
      });
    }
  }
});

// Save or update draft
router.post('/draft', async (req: AuthRequest, res) => {
  const { 
    account_id, 
    to, 
    cc, 
    bcc, 
    subject, 
    text_body, 
    html_body,
    draft_id 
  } = req.body;

  try {
    // Verify account ownership
    const accountCheck = await pool.query(
      'SELECT id FROM email_accounts WHERE id = $1 AND user_id = $2',
      [account_id, req.user!.id]
    );

    if (accountCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Account not found' });
    }

    if (draft_id) {
      // Update existing draft
      const result = await pool.query(
        `UPDATE drafts 
         SET to_address = $1, cc_address = $2, bcc_address = $3, 
             subject = $4, body = $5, updated_at = CURRENT_TIMESTAMP
         WHERE id = $6 AND user_id = $7
         RETURNING id`,
        [to, cc, bcc, subject, text_body || html_body, draft_id, req.user!.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      res.json({ message: 'Draft updated', draft_id: result.rows[0].id });
    } else {
      // Create new draft
      const result = await pool.query(
        `INSERT INTO drafts (user_id, email_account_id, to_address, cc_address, bcc_address, subject, body)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [req.user!.id, account_id, to, cc, bcc, subject, text_body || html_body]
      );

      res.json({ message: 'Draft saved', draft_id: result.rows[0].id });
    }
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

// Get drafts
router.get('/drafts', async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, ea.email, ea.display_name 
       FROM drafts d
       JOIN email_accounts ea ON d.email_account_id = ea.id
       WHERE d.user_id = $1
       ORDER BY d.updated_at DESC`,
      [req.user!.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get drafts error:', error);
    res.status(500).json({ error: 'Failed to get drafts' });
  }
});

// Delete draft
router.delete('/draft/:draftId', async (req: AuthRequest, res) => {
  const { draftId } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM drafts WHERE id = $1 AND user_id = $2 RETURNING id',
      [draftId, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    res.json({ message: 'Draft deleted' });
  } catch (error) {
    console.error('Delete draft error:', error);
    res.status(500).json({ error: 'Failed to delete draft' });
  }
});

router.patch('/:emailId', async (req: AuthRequest, res) => {
  const { emailId } = req.params;
  
  // Check if body exists
  if (!req.body) {
    console.error('No request body received');
    return res.status(400).json({ error: 'Request body is required' });
  }
  
  const { 
    is_read, is_starred, is_archived, is_draft, 
    is_spam, is_trash, is_snoozed, snoozed_until, labels 
  } = req.body;

  console.log('PATCH /mail/:emailId - Request body:', req.body);
  console.log('Email ID:', emailId);

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (is_read !== undefined) {
      updates.push(`is_read = $${paramCount++}`);
      values.push(is_read);
    }
    if (is_starred !== undefined) {
      updates.push(`is_starred = $${paramCount++}`);
      values.push(is_starred);
    }
    if (is_archived !== undefined) {
      updates.push(`is_archived = $${paramCount++}`);
      values.push(is_archived);
    }
    if (is_draft !== undefined) {
      updates.push(`is_draft = $${paramCount++}`);
      values.push(is_draft);
    }
    if (is_spam !== undefined) {
      updates.push(`is_spam = $${paramCount++}`);
      values.push(is_spam);
    }
    if (is_trash !== undefined) {
      updates.push(`is_trash = $${paramCount++}`);
      values.push(is_trash);
    }
    if (is_snoozed !== undefined) {
      updates.push(`is_snoozed = $${paramCount++}`);
      values.push(is_snoozed);
    }
    if (snoozed_until !== undefined) {
      updates.push(`snoozed_until = $${paramCount++}`);
      values.push(snoozed_until);
    }
    if (labels !== undefined) {
      updates.push(`labels = $${paramCount++}`);
      values.push(labels);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(emailId, req.user!.id);

    const result = await pool.query(
      `UPDATE cached_emails ce
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       FROM email_accounts ea
       WHERE ce.id = $${paramCount} 
       AND ce.email_account_id = ea.id 
       AND ea.user_id = $${paramCount + 1}
       RETURNING ce.id`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json({ message: 'Email updated successfully' });
  } catch (error) {
    console.error('Update email error:', error);
    res.status(500).json({ error: 'Failed to update email' });
  }
});

export default router;