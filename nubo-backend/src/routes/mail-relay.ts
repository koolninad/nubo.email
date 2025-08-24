import { Router } from 'express';
import nodemailer from 'nodemailer';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Configure SMTP relay service (example with SendGrid)
const RELAY_CONFIG = {
  SENDGRID: {
    host: 'smtp.sendgrid.net',
    port: 587,
    auth: {
      user: 'apikey',
      pass: process.env.SENDGRID_API_KEY || ''
    }
  },
  AMAZON_SES: {
    host: 'email-smtp.us-east-1.amazonaws.com',
    port: 587,
    auth: {
      user: process.env.AWS_SMTP_USER || '',
      pass: process.env.AWS_SMTP_PASS || ''
    }
  },
  MAILGUN: {
    host: 'smtp.mailgun.org',
    port: 587,
    auth: {
      user: process.env.MAILGUN_USER || '',
      pass: process.env.MAILGUN_PASS || ''
    }
  }
};

// Send email through relay service
router.post('/send-relay', async (req: AuthRequest, res) => {
  const { to, subject, text, html, from_email, from_name } = req.body;
  
  try {
    // Use SendGrid by default, or configure based on environment
    const relayService = process.env.RELAY_SERVICE || 'SENDGRID';
    const config = RELAY_CONFIG[relayService as keyof typeof RELAY_CONFIG];
    
    if (!config.auth.pass) {
      return res.status(500).json({ 
        error: 'Relay service not configured',
        suggestion: 'Please configure SENDGRID_API_KEY in environment variables'
      });
    }
    
    const transporter = nodemailer.createTransport({
      ...config,
      secure: false,
      requireTLS: true
    });
    
    const mailOptions = {
      from: `"${from_name}" <${from_email}>`,
      to,
      subject,
      text,
      html,
      headers: {
        'X-Mailer': 'Nubo Email Client'
      }
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    res.json({ 
      message: 'Email sent successfully via relay',
      messageId: info.messageId,
      accepted: info.accepted
    });
  } catch (error: any) {
    console.error('Relay send error:', error);
    res.status(500).json({ 
      error: 'Failed to send email through relay',
      details: error.message
    });
  }
});

export default router;