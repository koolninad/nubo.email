import { Router } from 'express';
import { pool } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import { emailCacheOAuthService } from '../services/emailCacheOAuth';
import { PushNotificationService } from '../services/pushNotifications';
import { 
  cacheEmailBody, 
  getCachedEmailBody, 
  cacheEmailList, 
  getCachedEmailList,
  clearUserCache 
} from '../db/redis';

const router = Router();

// Get unread counts for all accounts
router.get('/unread-counts', async (req: AuthRequest, res) => {
  try {
    const query = `
      SELECT 
        ea.id as account_id,
        COUNT(CASE WHEN NOT ce.is_read AND NOT ce.is_archived AND NOT ce.is_spam AND NOT ce.is_trash AND NOT ce.is_snoozed AND NOT ce.is_deleted THEN 1 END) as unread_count
      FROM email_accounts ea
      LEFT JOIN cached_emails ce ON ea.id = ce.email_account_id
      WHERE ea.user_id = $1
      GROUP BY ea.id
    `;
    
    const result = await pool.query(query, [req.user!.id]);
    
    // Convert to object for easy lookup
    const counts: Record<number, number> = {};
    let total = 0;
    result.rows.forEach(row => {
      counts[row.account_id] = parseInt(row.unread_count) || 0;
      total += parseInt(row.unread_count) || 0;
    });
    
    res.json({ 
      perAccount: counts,
      total: total 
    });
  } catch (error) {
    console.error('Get unread counts error:', error);
    res.status(500).json({ error: 'Failed to fetch unread counts' });
  }
});

router.get('/inbox', async (req: AuthRequest, res) => {
  const { account_id, limit = 50, offset = 0 } = req.query;

  try {
    if (account_id) {
      // Single account - fetch normally
      const query = `
        SELECT ce.*, ea.email as account_email, ea.auth_type 
        FROM cached_emails ce
        JOIN email_accounts ea ON ce.email_account_id = ea.id
        WHERE ea.user_id = $1 AND ea.id = $2 AND NOT ce.is_deleted
        ORDER BY ce.date DESC
        LIMIT $3 OFFSET $4
      `;
      const params = [req.user!.id, account_id, limit, offset];
      console.log(`📧 Loading emails for account ${account_id}, user ${req.user!.id}`);
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } else {
      // All accounts - fetch from each account and merge
      console.log(`📧 Loading ALL emails for user ${req.user!.id} - fetching from each account`);
      
      // First get all user's accounts
      const accountsResult = await pool.query(
        'SELECT id FROM email_accounts WHERE user_id = $1',
        [req.user!.id]
      );
      
      if (accountsResult.rows.length === 0) {
        return res.json([]);
      }
      
      // Fetch emails from each account (100 emails per account)
      const emailPromises = accountsResult.rows.map(account => {
        const perAccountLimit = 100; // Fetch 100 emails from each account
        const query = `
          SELECT ce.*, ea.email as account_email, ea.auth_type, ea.display_name
          FROM cached_emails ce
          JOIN email_accounts ea ON ce.email_account_id = ea.id
          WHERE ea.user_id = $1 AND ea.id = $2 AND NOT ce.is_deleted
          ORDER BY ce.date DESC
          LIMIT $3
        `;
        return pool.query(query, [req.user!.id, account.id, perAccountLimit]);
      });
      
      // Wait for all queries to complete
      const results = await Promise.all(emailPromises);
      
      // Merge all emails
      let allEmails: any[] = [];
      results.forEach(result => {
        allEmails = allEmails.concat(result.rows);
      });
      
      // Sort by date DESC and apply limit
      allEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Apply pagination
      const paginatedEmails = allEmails.slice(Number(offset), Number(offset) + Number(limit));
      
      // Log distribution
      const authTypes = paginatedEmails.reduce((acc: any, row: any) => {
        acc[row.auth_type] = (acc[row.auth_type] || 0) + 1;
        return acc;
      }, {});
      const accountDist = paginatedEmails.reduce((acc: any, row: any) => {
        acc[row.display_name || row.account_email] = (acc[row.display_name || row.account_email] || 0) + 1;
        return acc;
      }, {});
      
      console.log(`📊 Email distribution by auth: ${JSON.stringify(authTypes)}`);
      console.log(`📊 Email distribution by account: ${JSON.stringify(accountDist)}`);
      console.log(`📊 Total emails fetched: ${allEmails.length}, Returned: ${paginatedEmails.length}`);
      
      res.json(paginatedEmails);
    }
  } catch (error) {
    console.error('Get inbox error:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

// Fetch email body on demand
router.get('/email/:emailId/body', async (req: AuthRequest, res) => {
  const { emailId } = req.params;

  try {
    // First check if we have the body cached - include OAuth info
    const emailResult = await pool.query(
      `SELECT ce.*, ea.*, ea.auth_type, ea.oauth_account_id 
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
    if (email.text_body || email.html_body) {
      return res.json({
        text_body: email.text_body || '',
        html_body: email.html_body || ''
      });
    }

    // Check if this is an OAuth account
    if (email.auth_type === 'OAUTH' && email.oauth_account_id) {
      // Use OAuth service for OAuth accounts
      const account = {
        id: email.email_account_id,
        user_id: email.user_id,
        email: email.email || email.email_address,
        email_address: email.email_address || email.email,
        imap_host: email.imap_host,
        imap_port: email.imap_port,
        username: email.username,
        password_encrypted: email.password_encrypted,
        oauth_account_id: email.oauth_account_id,
        auth_type: email.auth_type
      };
      
      const body = await emailCacheOAuthService.fetchEmailBody(account, email.folder, email.uid);
      return res.json({
        text_body: body.text,
        html_body: body.html
      });
    }

    // Otherwise, fetch it from IMAP using regular auth
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
            'UPDATE cached_emails SET text_body = $1, html_body = $2 WHERE id = $3',
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
      'DRAFTS': ['Drafts', '[Gmail]/Drafts', 'INBOX.Drafts'],
      'ARCHIVE': ['Archive', 'All Mail', '[Gmail]/All Mail', 'INBOX.Archive', 'Archives']
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
      `SELECT id, filename, content_type, size, storage_path as file_path
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
    
    // Configure authentication based on account type
    let authConfig: any;
    
    if (account.auth_type === 'OAUTH' && account.oauth_account_id) {
      // OAuth account - get fresh access token and use XOAUTH2
      console.log('🔐 Using OAuth XOAUTH2 authentication for sending');
      
      try {
        // Get valid access token (refreshes if needed)
        const { OAuthService } = require('../services/oauth.service');
        const accessToken = await OAuthService.getValidAccessToken(account.oauth_account_id);
        
        // Use XOAUTH2 authentication
        authConfig = {
          type: 'oauth2',
          user: account.smtp_username || account.username,
          accessToken: accessToken
        };
        
        console.log('✅ XOAUTH2 config ready for:', account.smtp_username || account.username);
      } catch (tokenError) {
        console.error('❌ Failed to get OAuth access token:', tokenError);
        return res.status(401).json({ 
          error: 'OAuth authentication failed. Please re-authenticate your account.',
          details: tokenError instanceof Error ? tokenError.message : 'Unknown error'
        });
      }
    } else {
      // Regular password authentication
      console.log('🔑 Using password authentication for sending');
      authConfig = {
        user: account.smtp_username || account.username,
        pass: account.smtp_password || account.password_encrypted
      };
    }
    
    console.log('SMTP Configuration:', {
      host: account.smtp_host,
      port: smtpPort,
      secure: isSecure,
      user: authConfig.user,
      authType: account.auth_type === 'OAUTH' ? 'XOAUTH2' : 'PASSWORD',
      from: account.email
    });
    
    const transporterConfig: any = {
      host: account.smtp_host,
      port: smtpPort,
      secure: isSecure, // true for 465, false for other ports
      auth: authConfig,
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      },
      debug: true, // Enable debug output
      logger: true // Log to console
    };
    
    // Add requireTLS for Microsoft/Outlook on port 587
    if (smtpPort === 587) {
      transporterConfig.requireTLS = true;
    }
    
    const transporter = nodemailer.createTransport(transporterConfig);

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
    
    // Send push notification for successful email send
    try {
      await PushNotificationService.sendEmailSentNotification(
        req.user!.id.toString(),
        {
          to: to,
          subject: subject,
          accountEmail: account.email
        }
      );
      console.log('📱 Push notification sent for email send confirmation');
    } catch (pushError) {
      console.error('❌ Failed to send email sent push notification:', pushError);
    }
    
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

// Debug notification configuration (no auth for testing)
router.get('/notification-debug-test', async (req: AuthRequest, res) => {
  try {
    const apiKeyConfigured = !!process.env.ONESIGNAL_REST_API_KEY;
    const apiKeyLength = process.env.ONESIGNAL_REST_API_KEY?.length || 0;
    const apiKeyValue = process.env.ONESIGNAL_REST_API_KEY || 'NOT_SET';
    
    console.log('🔍 Debug endpoint called - OneSignal config:', {
      apiKeyConfigured,
      apiKeyLength,
      apiKeyValue: apiKeyValue.substring(0, 20) + '...'
    });
    
    res.json({
      oneSignalAppId: 'fe4fe7fa-55cd-4d38-8ce7-2e8648879bbf',
      apiKeyConfigured,
      apiKeyLength,
      apiKeyPrefix: apiKeyValue.substring(0, 20) + '...',
      nodeEnv: process.env.NODE_ENV,
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: 'Debug failed' });
  }
});

// Debug notification configuration
router.get('/notification-debug', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id?.toString();
    const apiKeyConfigured = !!process.env.ONESIGNAL_REST_API_KEY;
    const apiKeyLength = process.env.ONESIGNAL_REST_API_KEY?.length || 0;
    
    res.json({
      userId,
      oneSignalAppId: 'fe4fe7fa-55cd-4d38-8ce7-2e8648879bbf',
      apiKeyConfigured,
      apiKeyLength,
      apiKeyPrefix: process.env.ONESIGNAL_REST_API_KEY?.substring(0, 10) + '...',
      nodeEnv: process.env.NODE_ENV,
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: 'Debug failed' });
  }
});

// Test push notification endpoint
router.post('/test-notification', async (req: AuthRequest, res) => {
  try {
    console.log('📬 Test notification request received for user:', req.user?.id);
    
    if (!req.user?.id) {
      console.error('❌ No user ID in request');
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const success = await PushNotificationService.sendTestNotification(req.user.id.toString());
    
    if (success) {
      console.log('✅ Test notification sent successfully');
      res.json({ message: 'Test notification sent successfully' });
    } else {
      console.log('⚠️ Test notification failed - user may not be subscribed');
      res.status(400).json({ 
        error: 'No active notification subscriptions found',
        message: 'Please ensure you have:\n1. Enabled notifications in your browser\n2. Allowed notifications for this site\n3. Refreshed the page after enabling notifications',
        userId: req.user.id.toString()
      });
    }
  } catch (error) {
    console.error('❌ Test notification error:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

export default router;