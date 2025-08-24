import { Router } from 'express';
import { pool } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, display_name, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, username, is_active, created_at FROM email_accounts WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user!.id]
    );
    // Map database fields to frontend expected fields
    const accounts = result.rows.map(row => ({
      id: row.id,
      email_address: row.email,
      display_name: row.display_name,
      imap_host: row.imap_host,
      imap_port: row.imap_port,
      imap_secure: row.imap_secure,
      imap_username: row.username,
      smtp_host: row.smtp_host,
      smtp_port: row.smtp_port,
      smtp_secure: row.smtp_secure,
      smtp_username: row.username,
      is_active: row.is_active,
      created_at: row.created_at
    }));
    res.json(accounts);
  } catch (error) {
    console.error('Get email accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch email accounts' });
  }
});

router.post('/test', async (req: AuthRequest, res) => {
  const {
    test_type = 'both', // 'imap', 'smtp', or 'both'
    imap_host,
    imap_port,
    imap_username,
    imap_password,
    smtp_host,
    smtp_port,
    smtp_username,
    smtp_password
  } = req.body;

  const errors = [];
  const successes = [];

  // Test IMAP if requested
  if (test_type === 'imap' || test_type === 'both') {
    if (imap_host && imap_username && imap_password) {
      try {
        const isSecure = imap_port === 993 || imap_port === '993';
        const testClient = new ImapFlow({
          host: imap_host,
          port: parseInt(imap_port || '993'),
          secure: isSecure,
          auth: {
            user: imap_username,
            pass: imap_password
          },
          logger: false,
          tls: {
            rejectUnauthorized: false
          }
        });

        await testClient.connect();
        await testClient.logout();
        successes.push('IMAP connection successful');
      } catch (error: any) {
        console.error('IMAP test failed:', error);
        if (error.authenticationFailed || error.message?.includes('auth')) {
          errors.push('IMAP authentication failed. Check username and password.');
        } else if (error.code === 'ERR_SSL_WRONG_VERSION_NUMBER') {
          errors.push('IMAP SSL error. Check port (143 for non-SSL, 993 for SSL).');
        } else {
          errors.push(`IMAP connection failed: ${error.message}`);
        }
      }
    } else {
      errors.push('Missing IMAP credentials');
    }
  }

  // Test SMTP if requested
  if (test_type === 'smtp' || test_type === 'both') {
    if (smtp_host && smtp_username && smtp_password) {
      try {
        const smtpPort = parseInt(smtp_port || '587');
        const isSecure = smtpPort === 465;
        
        const transporter = nodemailer.createTransport({
          host: smtp_host,
          port: smtpPort,
          secure: isSecure,
          auth: {
            user: smtp_username,
            pass: smtp_password
          },
          tls: {
            rejectUnauthorized: false
          },
          requireTLS: smtpPort === 587
        });

        await transporter.verify();
        successes.push('SMTP connection successful');
      } catch (error: any) {
        console.error('SMTP test failed:', error);
        if (error.code === 'EAUTH' || error.responseCode === 535) {
          errors.push('SMTP authentication failed. Check username and password. For Gmail/Yahoo/Outlook, use app-specific passwords.');
        } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
          errors.push('SMTP connection failed. Check server and port settings.');
        } else {
          errors.push(`SMTP connection failed: ${error.message}`);
        }
      }
    } else {
      errors.push('Missing SMTP credentials');
    }
  }

  if (errors.length > 0) {
    res.status(400).json({ 
      error: errors.join(' '),
      successes: successes.length > 0 ? successes : undefined
    });
  } else {
    res.json({ 
      message: 'All connections successful',
      successes 
    });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  const {
    email_address,
    display_name,
    imap_host,
    imap_port,
    imap_username,
    imap_password,
    smtp_host,
    smtp_port,
    smtp_username,
    smtp_password
  } = req.body;

  if (!email_address || !imap_host || !imap_username || !imap_password || !smtp_host) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }

  try {
    // Determine if connections should be secure based on ports
    const imap_secure = imap_port === 993 || imap_port === '993';
    const smtp_secure = smtp_port === 465 || smtp_port === '465';
    
    const testClient = new ImapFlow({
      host: imap_host,
      port: parseInt(imap_port || '993'),
      secure: imap_secure,
      auth: {
        user: imap_username,
        pass: imap_password
      },
      logger: false,
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    });

    await testClient.connect();
    await testClient.logout();

    const result = await pool.query(
      `INSERT INTO email_accounts 
      (user_id, email, display_name, imap_host, imap_port, imap_secure, 
       smtp_host, smtp_port, smtp_secure, username, password_encrypted) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
      RETURNING id, email, display_name, imap_host, imap_port, smtp_host, smtp_port, username, is_active, created_at`,
      [
        req.user!.id,
        email_address,
        display_name || email_address,
        imap_host,
        parseInt(imap_port || '993'),
        imap_secure,
        smtp_host,
        parseInt(smtp_port || '587'),
        smtp_secure,
        imap_username,
        imap_password // Should be encrypted in production
      ]
    );

    // Map database fields to frontend expected fields
    const newAccount = {
      id: result.rows[0].id,
      email_address: result.rows[0].email,
      display_name: result.rows[0].display_name,
      imap_host: result.rows[0].imap_host,
      imap_port: result.rows[0].imap_port,
      imap_username: result.rows[0].username,
      smtp_host: result.rows[0].smtp_host,
      smtp_port: result.rows[0].smtp_port,
      smtp_username: result.rows[0].username,
      is_active: result.rows[0].is_active,
      created_at: result.rows[0].created_at
    };

    res.status(201).json(newAccount);
  } catch (error: any) {
    console.error('Add email account error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      authenticationFailed: error.authenticationFailed,
      connectionError: error.connectionError
    });
    
    if (error.code === 'ERR_SSL_WRONG_VERSION_NUMBER') {
      res.status(400).json({ error: 'SSL/TLS connection error. Please check your port settings (143 for non-SSL, 993 for SSL).' });
    } else if (error.authenticationFailed || error.message?.includes('auth')) {
      res.status(400).json({ error: 'Authentication failed. Please check your username and password.' });
    } else if (error.message?.includes('connect') || error.connectionError) {
      res.status(400).json({ error: 'Failed to connect to email server. Please check your server settings.' });
    } else {
      res.status(500).json({ error: `Failed to add email account: ${error.message || 'Unknown error'}` });
    }
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const {
    email_address,
    display_name,
    imap_host,
    imap_port,
    imap_username,
    imap_password,
    smtp_host,
    smtp_port,
    smtp_username,
    smtp_password
  } = req.body;

  try {
    // Check if account exists and belongs to user
    const checkResult = await pool.query(
      'SELECT id FROM email_accounts WHERE id = $1 AND user_id = $2',
      [id, req.user!.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    // Test IMAP connection if password is provided
    if (imap_password) {
      const isSecure = imap_port === 993 || imap_port === '993';
      
      const testClient = new ImapFlow({
        host: imap_host,
        port: parseInt(imap_port || '993'),
        secure: isSecure,
        auth: {
          user: imap_username,
          pass: imap_password
        },
        logger: false,
        tls: {
          rejectUnauthorized: false
        }
      });

      try {
        await testClient.connect();
        await testClient.logout();
      } catch (error: any) {
        console.error('IMAP test failed:', error);
        if (error.authenticationFailed || error.message?.includes('auth')) {
          return res.status(400).json({ error: 'IMAP authentication failed. Please check your credentials.' });
        }
        return res.status(400).json({ error: 'Failed to connect to IMAP server.' });
      }
    }

    // Build update query based on provided fields
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (email_address) {
      updates.push(`email = $${paramCount++}`);
      values.push(email_address);
    }
    if (display_name !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      values.push(display_name);
    }
    if (imap_host) {
      updates.push(`imap_host = $${paramCount++}`);
      values.push(imap_host);
    }
    if (imap_port) {
      updates.push(`imap_port = $${paramCount++}`);
      values.push(parseInt(imap_port));
      updates.push(`imap_secure = $${paramCount++}`);
      values.push(imap_port === '993' || imap_port === 993);
    }
    if (imap_username) {
      updates.push(`username = $${paramCount++}`);
      values.push(imap_username);
    }
    if (imap_password) {
      updates.push(`password_encrypted = $${paramCount++}`);
      values.push(imap_password);
    }
    if (smtp_host) {
      updates.push(`smtp_host = $${paramCount++}`);
      values.push(smtp_host);
    }
    if (smtp_port) {
      updates.push(`smtp_port = $${paramCount++}`);
      values.push(parseInt(smtp_port));
      updates.push(`smtp_secure = $${paramCount++}`);
      values.push(smtp_port === '465' || smtp_port === 465);
    }
    // Note: We use the same username for both IMAP and SMTP
    // since the database only has one username field
    if (smtp_username && !imap_username) {
      updates.push(`username = $${paramCount++}`);
      values.push(smtp_username);
    }
    if (smtp_password && !imap_password) {
      updates.push(`password_encrypted = $${paramCount++}`);
      values.push(smtp_password);
    }

    values.push(id, req.user!.id);

    const result = await pool.query(
      `UPDATE email_accounts 
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
       RETURNING id, email, display_name, imap_host, imap_port, smtp_host, smtp_port, username, is_active`,
      values
    );

    // Map database fields to frontend expected fields
    const updatedAccount = {
      id: result.rows[0].id,
      email_address: result.rows[0].email,
      display_name: result.rows[0].display_name,
      imap_host: result.rows[0].imap_host,
      imap_port: result.rows[0].imap_port,
      imap_username: result.rows[0].username,
      smtp_host: result.rows[0].smtp_host,
      smtp_port: result.rows[0].smtp_port,
      smtp_username: result.rows[0].username,
      is_active: result.rows[0].is_active
    };

    res.json(updatedAccount);
  } catch (error: any) {
    console.error('Update email account error:', error);
    res.status(500).json({ error: `Failed to update email account: ${error.message || 'Unknown error'}` });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM email_accounts WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    res.json({ message: 'Email account deleted successfully' });
  } catch (error) {
    console.error('Delete email account error:', error);
    res.status(500).json({ error: 'Failed to delete email account' });
  }
});

export default router;