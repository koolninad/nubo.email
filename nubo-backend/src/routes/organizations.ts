import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticateToken } from '../middleware/auth';
import Razorpay from 'razorpay';

const router = Router();

// Initialize database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://nubo:nubo123@localhost:5433/nubo_email'
});

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_RBU4Yv4G8Qibce',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '8icR3I5nXpSkiSaKJVxtSWZb'
});

// Calculate storage based on plan
const getStorageInMB = (plan: string): number => {
  const storageMap: { [key: string]: number } = {
    '5GB': 5 * 1024,
    '25GB': 25 * 1024,
    '100GB': 100 * 1024,
    '500GB': 500 * 1024,
    '1TB': 1024 * 1024
  };
  return storageMap[plan] || 5 * 1024;
};

// Submit onboarding request (public endpoint)
router.post('/onboarding/submit', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      businessDetails,
      planSelection,
      domainConfig,
      emailAccounts,
      totalPrice
    } = req.body;

    // Hash the password
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(businessDetails.password, 10);

    // Insert onboarding request with username and password
    const requestResult = await client.query(
      `INSERT INTO onboarding_requests (
        name, organization, email, phone, gst_number, domain,
        storage_plan, billing_cycle, deployment_type, hybrid_provider,
        archival_plan, archival_users, email_accounts, total_price,
        username, password_hash, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'pending')
      RETURNING id`,
      [
        businessDetails.name,
        businessDetails.organization,
        businessDetails.email,
        businessDetails.phone,
        businessDetails.gstNumber || businessDetails.gst || null,
        businessDetails.domain,
        planSelection.storage || planSelection.plan,
        planSelection.billingCycle,
        planSelection.deploymentType,
        planSelection.hybridProvider || null,
        planSelection.archivalPlan || null,
        planSelection.archivalUsers || 0,
        JSON.stringify(emailAccounts),
        totalPrice,
        businessDetails.username,
        passwordHash
      ]
    );

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalPrice * 100), // Convert to paise
      currency: 'INR',
      receipt: `ORD-${requestResult.rows[0].id}`,
      notes: {
        onboarding_request_id: requestResult.rows[0].id,
        organization: businessDetails.organization
      }
    });

    await client.query('COMMIT');

    res.json({
      success: true,
      requestId: requestResult.rows[0].id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_RBU4Yv4G8Qibce'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Onboarding submission error:', error);
    res.status(500).json({
      error: 'Failed to submit onboarding request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Verify payment and create organization
router.post('/onboarding/verify-payment', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const { requestId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    // Verify signature (skip in test mode with test keys)
    const isTestMode = (process.env.RAZORPAY_KEY_ID || 'rzp_test_RBU4Yv4G8Qibce').includes('test');
    
    if (!isTestMode) {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '8icR3I5nXpSkiSaKJVxtSWZb')
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (expectedSignature !== razorpaySignature) {
        throw new Error('Invalid payment signature');
      }
    } else {
      console.log('Test mode - skipping signature verification');
    }

    await client.query('BEGIN');

    // Get onboarding request
    const requestResult = await client.query(
      'SELECT * FROM onboarding_requests WHERE id = $1',
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error('Onboarding request not found');
    }

    const request = requestResult.rows[0];

    // Create organization
    const orgResult = await client.query(
      `INSERT INTO organizations (
        name, domain, contact_name, contact_email, contact_phone,
        gst_number, storage_plan, billing_cycle, deployment_type,
        hybrid_provider, archival_plan, archival_users_purchased,
        storage_total_mb, status, razorpay_customer_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', $14)
      RETURNING id`,
      [
        request.organization,
        request.domain,
        request.name,
        request.email,
        request.phone,
        request.gst_number,
        request.storage_plan,
        request.billing_cycle,
        request.deployment_type,
        request.hybrid_provider,
        request.archival_plan,
        request.archival_users,
        getStorageInMB(request.storage_plan),
        `cust_${Date.now()}` // Generate customer ID
      ]
    );

    const organizationId = orgResult.rows[0].id;

    // Create user account for the organization admin
    let userId = null;
    if (request.username && request.password_hash) {
      try {
        const userResult = await client.query(
          `INSERT INTO users (
            username, email, password_hash, is_admin, is_active
          ) VALUES ($1, $2, $3, true, true)
          ON CONFLICT (username) DO NOTHING
          RETURNING id`,
          [
            request.username,
            request.email,
            request.password_hash
          ]
        );
        
        if (userResult.rows.length > 0) {
          userId = userResult.rows[0].id;
          
          // Check if organization_id column exists before updating
          const columnCheck = await client.query(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_name = 'users' AND column_name = 'organization_id'`
          );
          
          if (columnCheck.rows.length > 0) {
            // Column exists, update it
            await client.query(
              `UPDATE users SET organization_id = $1 WHERE id = $2`,
              [organizationId, userId]
            );
          } else {
            console.log('organization_id column does not exist in users table');
          }
        }
      } catch (userError) {
        console.error('Error creating user:', userError);
        // Continue without user creation - organization is more important
      }
    }

    // Create email accounts
    const emailAccounts = typeof request.email_accounts === 'string' 
      ? JSON.parse(request.email_accounts) 
      : request.email_accounts;
    for (const account of emailAccounts) {
      await client.query(
        `INSERT INTO organization_email_accounts (
          organization_id, email, username, full_name,
          storage_allocated_mb, archival_enabled, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
        [
          organizationId,
          account.email,
          account.username || account.email.split('@')[0], // Use email prefix as username if not provided
          account.fullName || account.email.split('@')[0], // Use email prefix as full name if not provided
          account.storage || 5120, // Default to 5GB if not provided
          account.archival || false
        ]
      );
    }

    // Create billing record
    await client.query(
      `INSERT INTO billing_history (
        organization_id, amount, currency, billing_cycle,
        razorpay_payment_id, razorpay_order_id, razorpay_signature,
        status, billing_period_start, billing_period_end, paid_at
      ) VALUES ($1, $2, 'INR', $3, $4, $5, $6, 'completed', CURRENT_DATE, 
        CURRENT_DATE + INTERVAL '1 ${request.billing_cycle === 'monthly' ? 'month' : 'year'}',
        CURRENT_TIMESTAMP)`,
      [
        organizationId,
        request.total_price,
        request.billing_cycle,
        razorpayPaymentId,
        razorpayOrderId,
        razorpaySignature
      ]
    );

    // Update onboarding request with payment details
    await client.query(
      `UPDATE onboarding_requests 
       SET status = $1, organization_id = $2, payment_status = 'paid', 
           payment_date = CURRENT_TIMESTAMP, razorpay_payment_id = $3, 
           razorpay_order_id = $4
       WHERE id = $5`,
      ['processing', organizationId, razorpayPaymentId, razorpayOrderId, requestId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      organizationId,
      message: 'Payment verified successfully. Your organization is being set up.'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Payment verification error:', error);
    res.status(500).json({
      error: 'Failed to verify payment',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Get organization details (authenticated)
router.get('/organizations/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get organization
    const orgResult = await pool.query(
      'SELECT * FROM organizations WHERE id = $1',
      [id]
    );

    if (orgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get email accounts
    const accountsResult = await pool.query(
      'SELECT * FROM organization_email_accounts WHERE organization_id = $1',
      [id]
    );

    // Calculate storage usage
    const storageUsed = accountsResult.rows.reduce((sum, acc) => sum + (acc.storage_used_mb || 0), 0);
    const storageAllocated = accountsResult.rows.reduce((sum, acc) => sum + acc.storage_allocated_mb, 0);

    res.json({
      organization: {
        ...orgResult.rows[0],
        storage_used_mb: storageUsed,
        storage_allocated_mb: storageAllocated
      },
      emailAccounts: accountsResult.rows
    });

  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({
      error: 'Failed to fetch organization details',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create/update email accounts for organization
router.post('/organizations/:id/email-accounts', authenticateToken, async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { accounts } = req.body;

    await client.query('BEGIN');

    // Verify organization exists and user has access
    const orgResult = await client.query(
      'SELECT * FROM organizations WHERE id = $1',
      [id]
    );

    if (orgResult.rows.length === 0) {
      throw new Error('Organization not found');
    }

    const organization = orgResult.rows[0];

    // Calculate total requested storage
    const requestedStorage = accounts.reduce((sum: number, acc: any) => sum + acc.storage, 0);
    
    if (requestedStorage > organization.storage_total_mb) {
      throw new Error('Requested storage exceeds organization limit');
    }

    // Process each account
    for (const account of accounts) {
      // Check if account exists
      const existingAccount = await client.query(
        'SELECT id FROM organization_email_accounts WHERE organization_id = $1 AND username = $2',
        [id, account.username]
      );

      if (existingAccount.rows.length > 0) {
        // Update existing account
        await client.query(
          `UPDATE organization_email_accounts 
           SET full_name = $1, storage_allocated_mb = $2, archival_enabled = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [account.fullName, account.storage, account.archival || false, existingAccount.rows[0].id]
        );
      } else {
        // Create new account
        await client.query(
          `INSERT INTO organization_email_accounts (
            organization_id, email, username, full_name,
            storage_allocated_mb, archival_enabled, status
          ) VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
          [
            id,
            `${account.username}@${organization.domain}`,
            account.username,
            account.fullName,
            account.storage,
            account.archival || false
          ]
        );
      }
    }

    // Update organization storage allocation
    await client.query(
      'UPDATE organizations SET storage_allocated_mb = $1 WHERE id = $2',
      [requestedStorage, id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Email accounts updated successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update email accounts error:', error);
    res.status(500).json({
      error: 'Failed to update email accounts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Get all onboarding requests with payment status (admin only)
router.get('/admin/onboarding-requests', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Check if user is admin (you'll need to implement this check)
    // For now, we'll assume the authenticated user is an admin

    const result = await pool.query(
      `SELECT 
        r.*,
        CASE 
          WHEN r.payment_status IS NOT NULL THEN r.payment_status
          WHEN r.status = 'approved' AND r.razorpay_payment_id IS NOT NULL THEN 'paid'
          WHEN r.status = 'approved' AND r.razorpay_payment_id IS NULL THEN 'unpaid'
          ELSE 'pending'
        END as display_payment_status
       FROM onboarding_requests r
       ORDER BY r.created_at DESC`
    );

    res.json({
      requests: result.rows
    });

  } catch (error) {
    console.error('Get onboarding requests error:', error);
    res.status(500).json({
      error: 'Failed to fetch onboarding requests',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get single onboarding request (admin only)
router.get('/admin/onboarding-requests/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get request details
    const requestResult = await pool.query(
      `SELECT 
        r.*,
        CASE 
          WHEN r.payment_status IS NOT NULL THEN r.payment_status
          WHEN r.status = 'approved' AND r.razorpay_payment_id IS NOT NULL THEN 'paid'
          WHEN r.status = 'approved' AND r.razorpay_payment_id IS NULL THEN 'unpaid'
          ELSE 'pending'
        END as display_payment_status,
        u.username as reviewed_by_username
       FROM onboarding_requests r
       LEFT JOIN users u ON r.reviewed_by = u.id
       WHERE r.id = $1`,
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requestResult.rows[0];

    // Get organization details if exists
    let organization = null;
    if (request.organization_id) {
      const orgResult = await pool.query(
        'SELECT * FROM organizations WHERE id = $1',
        [request.organization_id]
      );
      if (orgResult.rows.length > 0) {
        organization = orgResult.rows[0];
      }
    }

    // Get billing details if payment exists
    let billingDetails = null;
    if (request.razorpay_payment_id) {
      const billingResult = await pool.query(
        `SELECT * FROM billing_history 
         WHERE razorpay_payment_id = $1 
         LIMIT 1`,
        [request.razorpay_payment_id]
      );
      if (billingResult.rows.length > 0) {
        billingDetails = billingResult.rows[0];
      }
    }

    res.json({
      request,
      organization,
      billingDetails
    });

  } catch (error) {
    console.error('Get onboarding request error:', error);
    res.status(500).json({
      error: 'Failed to fetch onboarding request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Approve/reject onboarding request (admin only)
router.post('/admin/onboarding-requests/:id/review', authenticateToken, async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // action: 'approve' or 'reject'
    const userId = (req as any).user?.id;

    await client.query('BEGIN');

    if (action === 'approve') {
      // Update request status
      await client.query(
        `UPDATE onboarding_requests 
         SET status = 'approved', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [userId, id]
      );

      // Get organization ID
      const reqResult = await client.query(
        'SELECT organization_id FROM onboarding_requests WHERE id = $1',
        [id]
      );

      if (reqResult.rows[0]?.organization_id) {
        // Activate organization
        await client.query(
          `UPDATE organizations 
           SET status = 'active', approval_status = 'approved', 
               approved_by = $1, approved_at = CURRENT_TIMESTAMP, activated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [userId, reqResult.rows[0].organization_id]
        );

        // Activate email accounts
        await client.query(
          `UPDATE organization_email_accounts 
           SET status = 'active' 
           WHERE organization_id = $1`,
          [reqResult.rows[0].organization_id]
        );
      }
    } else {
      // Reject request
      await client.query(
        `UPDATE onboarding_requests 
         SET status = 'rejected', rejection_reason = $1, 
             reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [reason, userId, id]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Request ${action}ed successfully`
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Review onboarding request error:', error);
    res.status(500).json({
      error: 'Failed to review onboarding request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Get organization billing history
router.get('/organizations/:id/billing', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM billing_history 
       WHERE organization_id = $1 
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      billingHistory: result.rows
    });

  } catch (error) {
    console.error('Get billing history error:', error);
    res.status(500).json({
      error: 'Failed to fetch billing history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Submit storage upgrade request
router.post('/organizations/:id/upgrade-request', authenticateToken, async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { 
      requestType, 
      requestedPlan, 
      additionalArchivalUsers,
      additionalAccounts 
    } = req.body;

    await client.query('BEGIN');

    // Get current organization details
    const orgResult = await client.query(
      'SELECT * FROM organizations WHERE id = $1',
      [id]
    );

    if (orgResult.rows.length === 0) {
      throw new Error('Organization not found');
    }

    const org = orgResult.rows[0];

    // Calculate costs
    let additionalCost = 0;
    if (requestedPlan) {
      const currentPlanCost = getStorageInMB(org.storage_plan) * 0.03; // Example pricing
      const newPlanCost = getStorageInMB(requestedPlan) * 0.03;
      additionalCost = newPlanCost - currentPlanCost;
    }
    if (additionalArchivalUsers) {
      additionalCost += additionalArchivalUsers * 500; // ₹500 per user
    }

    // Insert upgrade request
    const requestResult = await client.query(
      `INSERT INTO storage_upgrade_requests (
        organization_id, request_type, current_plan, requested_plan,
        current_archival_users, requested_archival_users,
        additional_accounts, additional_cost, total_new_cost,
        payment_status, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'not_required', 'pending')
      RETURNING id`,
      [
        id,
        requestType,
        org.storage_plan,
        requestedPlan,
        org.archival_users_purchased,
        org.archival_users_purchased + (additionalArchivalUsers || 0),
        JSON.stringify(additionalAccounts || []),
        additionalCost,
        additionalCost + (org.monthly_cost || 0)
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      requestId: requestResult.rows[0].id,
      message: 'Upgrade request submitted successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Submit upgrade request error:', error);
    res.status(500).json({
      error: 'Failed to submit upgrade request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Get organization upgrade requests
router.get('/organizations/:id/upgrade-requests', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM storage_upgrade_requests 
       WHERE organization_id = $1 
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      requests: result.rows
    });

  } catch (error) {
    console.error('Get upgrade requests error:', error);
    res.status(500).json({
      error: 'Failed to fetch upgrade requests',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get organization subscriptions
router.get('/organizations/:id/subscriptions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM subscriptions 
       WHERE organization_id = $1 AND status = 'active'
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      subscriptions: result.rows
    });

  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({
      error: 'Failed to fetch subscriptions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cancel subscription
router.post('/organizations/:id/subscriptions/:subId/cancel', authenticateToken, async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const { id, subId } = req.params;
    const { reason } = req.body;

    await client.query('BEGIN');

    // Update subscription status
    await client.query(
      `UPDATE subscriptions 
       SET status = 'cancelled', 
           cancelled_at = CURRENT_TIMESTAMP,
           cancellation_reason = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND organization_id = $3`,
      [reason, subId, id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      error: 'Failed to cancel subscription',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

export default router;