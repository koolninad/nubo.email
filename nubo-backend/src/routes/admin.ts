import { Router } from 'express';
import { pool } from '../db/pool';
import { authenticateToken } from '../middleware/auth';
import { backgroundEmailSync } from '../services/backgroundEmailSync';
import bcrypt from 'bcryptjs';

const router = Router();

// Middleware to check if user is admin
const isAdmin = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get system overview metrics
 */
router.get('/dashboard', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Get total users count
    const usersResult = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_users_week,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as new_users_month,
        COUNT(CASE WHEN last_login > NOW() - INTERVAL '24 hours' THEN 1 END) as active_today,
        COUNT(CASE WHEN last_login > NOW() - INTERVAL '7 days' THEN 1 END) as active_week
      FROM users
    `);

    // Get email accounts statistics
    const accountsResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT ea.id) as total_accounts,
        COUNT(DISTINCT ea.user_id) as users_with_accounts,
        COUNT(CASE WHEN ea.is_active = true THEN 1 END) as active_accounts,
        COUNT(CASE WHEN ea.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_accounts_week,
        COALESCE(AVG(accounts_per_user.count), 0) as avg_accounts_per_user,
        COALESCE(MAX(accounts_per_user.count), 0) as max_accounts_per_user
      FROM email_accounts ea
      LEFT JOIN (
        SELECT user_id, COUNT(*) as count
        FROM email_accounts
        GROUP BY user_id
      ) accounts_per_user ON ea.user_id = accounts_per_user.user_id
    `);

    // Get cached emails statistics
    const emailsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_cached_emails,
        COUNT(DISTINCT email_account_id) as accounts_with_cache,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as emails_cached_today,
        COUNT(CASE WHEN body_compressed IS NOT NULL THEN 1 END) as emails_with_body,
        pg_size_pretty(SUM(pg_column_size(body_compressed))) as total_cache_size
      FROM cached_emails
    `);

    // Get sync status
    const syncStatusResult = await pool.query(`
      SELECT 
        COUNT(*) as total_sync_jobs,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running_jobs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as jobs_last_hour
      FROM email_sync_jobs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);

    // Get sync errors from last 24 hours
    const syncErrorsResult = await pool.query(`
      SELECT 
        folder,
        error_message,
        COUNT(*) as error_count,
        MAX(updated_at) as last_error
      FROM email_sync_status
      WHERE error_message IS NOT NULL 
        AND updated_at > NOW() - INTERVAL '24 hours'
      GROUP BY folder, error_message
      ORDER BY error_count DESC
      LIMIT 10
    `);

    // Get storage usage
    const storageResult = await pool.query(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as database_size,
        pg_size_pretty(pg_total_relation_size('cached_emails')) as emails_table_size,
        pg_size_pretty(pg_total_relation_size('email_attachments')) as attachments_table_size
    `);

    // Get background sync status
    const backgroundSyncStatus = backgroundEmailSync.getSyncStatus();

    // Get provider statistics
    const providerResult = await pool.query(`
      SELECT 
        CASE 
          WHEN imap_host LIKE '%gmail%' THEN 'Gmail'
          WHEN imap_host LIKE '%outlook%' OR imap_host LIKE '%hotmail%' THEN 'Outlook'
          WHEN imap_host LIKE '%yahoo%' THEN 'Yahoo'
          WHEN imap_host LIKE '%icloud%' THEN 'iCloud'
          WHEN imap_host LIKE '%zoho%' THEN 'Zoho'
          ELSE 'Other'
        END as provider,
        COUNT(*) as count
      FROM email_accounts
      GROUP BY provider
      ORDER BY count DESC
    `);

    res.json({
      users: usersResult.rows[0],
      accounts: accountsResult.rows[0],
      emails: emailsResult.rows[0],
      sync: {
        ...syncStatusResult.rows[0],
        errors: syncErrorsResult.rows,
        backgroundStatus: backgroundSyncStatus
      },
      storage: storageResult.rows[0],
      providers: providerResult.rows
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * Get all users with their account information
 */
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT 
        u.id,
        u.username,
        u.email,
        u.is_active,
        u.is_admin,
        u.created_at,
        u.last_login,
        u.two_factor_enabled,
        COUNT(DISTINCT ea.id) as email_accounts_count,
        COUNT(DISTINCT ce.id) as cached_emails_count,
        MAX(ea.created_at) as last_account_added
      FROM users u
      LEFT JOIN email_accounts ea ON u.id = ea.user_id
      LEFT JOIN cached_emails ce ON ea.id = ce.email_account_id
    `;

    const params: any[] = [];
    
    if (search) {
      query += ` WHERE u.username ILIKE $1 OR u.email ILIKE $1`;
      params.push(`%${search}%`);
    }

    query += `
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    params.push(Number(limit), offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM users';
    const countParams: any[] = [];
    
    if (search) {
      countQuery += ' WHERE username ILIKE $1 OR email ILIKE $1';
      countParams.push(`%${search}%`);
    }
    
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      users: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Users list error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * Get detailed user information
 */
router.get('/users/:userId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user details
    const userResult = await pool.query(
      'SELECT id, username, email, is_active, is_admin, created_at, last_login, two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's email accounts
    const accountsResult = await pool.query(`
      SELECT 
        ea.id,
        ea.email,
        ea.imap_host,
        ea.smtp_host,
        ea.is_active,
        ea.created_at,
        COUNT(ce.id) as cached_emails_count,
        MAX(ce.date) as latest_email,
        MIN(ce.date) as oldest_email
      FROM email_accounts ea
      LEFT JOIN cached_emails ce ON ea.id = ce.email_account_id
      WHERE ea.user_id = $1
      GROUP BY ea.id
      ORDER BY ea.created_at DESC
    `, [userId]);

    // Get sync statistics for user's accounts
    const syncStatsResult = await pool.query(`
      SELECT 
        ea.email,
        ess.folder,
        ess.last_sync_at,
        ess.total_messages,
        ess.synced_messages,
        ess.error_message
      FROM email_sync_status ess
      JOIN email_accounts ea ON ess.email_account_id = ea.id
      WHERE ea.user_id = $1
      ORDER BY ea.email, ess.folder
    `, [userId]);

    // Get recent login history
    const loginHistoryResult = await pool.query(`
      SELECT ip_address, user_agent, login_at
      FROM login_history
      WHERE user_id = $1
      ORDER BY login_at DESC
      LIMIT 10
    `, [userId]);

    res.json({
      user: userResult.rows[0],
      emailAccounts: accountsResult.rows,
      syncStats: syncStatsResult.rows,
      loginHistory: loginHistoryResult.rows
    });
  } catch (error) {
    console.error('User detail error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

/**
 * Update user status
 */
router.patch('/users/:userId/status', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_active } = req.body;

    await pool.query(
      'UPDATE users SET is_active = $1 WHERE id = $2',
      [is_active, userId]
    );

    res.json({ message: 'User status updated successfully' });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

/**
 * Get email account details
 */
router.get('/accounts/:accountId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { accountId } = req.params;

    const accountResult = await pool.query(`
      SELECT 
        ea.*,
        u.username,
        u.email as user_email,
        COUNT(DISTINCT ce.id) as total_emails,
        COUNT(DISTINCT ce.folder) as folders_count,
        pg_size_pretty(SUM(pg_column_size(ce.body_compressed))) as storage_used
      FROM email_accounts ea
      JOIN users u ON ea.user_id = u.id
      LEFT JOIN cached_emails ce ON ea.id = ce.email_account_id
      WHERE ea.id = $1
      GROUP BY ea.id, u.id
    `, [accountId]);

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get folder statistics
    const foldersResult = await pool.query(`
      SELECT 
        folder,
        COUNT(*) as email_count,
        MAX(date) as latest_email,
        MIN(date) as oldest_email,
        COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count
      FROM cached_emails
      WHERE email_account_id = $1
      GROUP BY folder
      ORDER BY email_count DESC
    `, [accountId]);

    res.json({
      account: accountResult.rows[0],
      folders: foldersResult.rows
    });
  } catch (error) {
    console.error('Account detail error:', error);
    res.status(500).json({ error: 'Failed to fetch account details' });
  }
});

/**
 * Force sync for specific account
 */
router.post('/accounts/:accountId/sync', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { folders = ['INBOX'], limit = 100 } = req.body;

    // Get account details
    const accountResult = await pool.query(
      'SELECT * FROM email_accounts WHERE id = $1',
      [accountId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Create sync job
    const jobResult = await pool.query(`
      INSERT INTO email_sync_jobs (email_account_id, job_type, status, metadata)
      VALUES ($1, 'MANUAL_SYNC', 'pending', $2)
      RETURNING id
    `, [accountId, JSON.stringify({ folders, limit })]);

    res.json({
      message: 'Sync initiated',
      jobId: jobResult.rows[0].id
    });
  } catch (error) {
    console.error('Force sync error:', error);
    res.status(500).json({ error: 'Failed to initiate sync' });
  }
});

/**
 * Get sync status for monitoring page
 */
router.get('/sync-status', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Get background sync status
    const syncStatus = backgroundEmailSync.getSyncStatus();
    
    // Get recent sync activity
    const recentSyncsResult = await pool.query(`
      SELECT 
        esj.id,
        esj.email_account_id as accountId,
        ea.email,
        u.username,
        esj.status,
        esj.created_at as startTime,
        esj.updated_at as endTime,
        COALESCE(esj.metadata->>'emailsSynced', '0')::int as emailsSynced,
        esj.error_message as error
      FROM email_sync_jobs esj
      JOIN email_accounts ea ON esj.email_account_id = ea.id
      JOIN users u ON ea.user_id = u.id
      WHERE esj.created_at > NOW() - INTERVAL '1 hour'
      ORDER BY esj.created_at DESC
      LIMIT 20
    `);
    
    // Get sync statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT ea.id) as totalAccounts,
        COUNT(DISTINCT CASE WHEN esj.status = 'completed' THEN ea.id END) as syncedAccounts,
        COUNT(DISTINCT CASE WHEN esj.status = 'failed' THEN ea.id END) as failedAccounts,
        COUNT(DISTINCT CASE WHEN esj.status = 'pending' OR esj.status = 'running' THEN ea.id END) as pendingAccounts,
        COALESCE(AVG(EXTRACT(EPOCH FROM (esj.updated_at - esj.created_at))), 0) as averageSyncTime
      FROM email_accounts ea
      LEFT JOIN email_sync_jobs esj ON ea.id = esj.email_account_id
        AND esj.created_at > NOW() - INTERVAL '24 hours'
    `);
    
    const stats = statsResult.rows[0];
    
    res.json({
      isRunning: syncStatus.isRunning,
      lastSync: syncStatus.lastSync,
      nextSync: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // Next sync in 5 minutes
      totalAccounts: parseInt(stats.totalaccounts) || 0,
      syncedAccounts: parseInt(stats.syncedaccounts) || 0,
      failedAccounts: parseInt(stats.failedaccounts) || 0,
      pendingAccounts: parseInt(stats.pendingaccounts) || 0,
      averageSyncTime: Math.round(stats.averagesynctime) || 0,
      recentSyncs: recentSyncsResult.rows.map(row => ({
        accountId: row.accountid,
        username: row.username,
        email: row.email,
        status: row.status === 'completed' ? 'success' : row.status === 'failed' ? 'failed' : 'in_progress',
        startTime: row.starttime,
        endTime: row.endtime,
        emailsSynced: row.emailssynced,
        error: row.error
      }))
    });
  } catch (error) {
    console.error('Sync status error:', error);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
});

/**
 * Get system health metrics
 */
router.get('/system-health', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Database health check
    const dbStartTime = Date.now();
    const dbResult = await pool.query('SELECT 1');
    const dbResponseTime = Date.now() - dbStartTime;
    
    // Get database connections
    const dbConnectionsResult = await pool.query(`
      SELECT count(*) as connections,
             max_connections
      FROM pg_stat_activity,
           (SELECT setting::int as max_connections FROM pg_settings WHERE name = 'max_connections') s
      GROUP BY max_connections
    `);
    
    // Redis health check (if redis client is available)
    let redisStatus = { status: 'unknown', responseTime: 0, memory: 0, maxMemory: 0, connectedClients: 0 };
    // Note: Redis check would go here if redis client is configured
    
    // Get system metrics
    const metricsResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT u.id) as totalUsers,
        COUNT(DISTINCT CASE WHEN u.last_login > NOW() - INTERVAL '24 hours' THEN u.id END) as activeUsers,
        COUNT(DISTINCT ce.id) as totalEmails,
        COUNT(DISTINCT CASE WHEN ce.created_at > NOW() - INTERVAL '24 hours' THEN ce.id END) as emailsToday
      FROM users u
      LEFT JOIN email_accounts ea ON u.id = ea.user_id
      LEFT JOIN cached_emails ce ON ea.id = ce.email_account_id
    `);
    
    // Get disk usage
    const diskResult = await pool.query(`
      SELECT 
        pg_database_size(current_database()) as database_size
    `);
    
    // Get sync service status
    const syncStatus = backgroundEmailSync.getSyncStatus();
    
    // Get recent alerts (errors from logs)
    const alertsResult = await pool.query(`
      SELECT 
        'warning' as level,
        CONCAT('Sync failed for ', ea.email, ': ', ess.error_message) as message,
        ess.updated_at as timestamp
      FROM email_sync_status ess
      JOIN email_accounts ea ON ess.email_account_id = ea.id
      WHERE ess.error_message IS NOT NULL
        AND ess.updated_at > NOW() - INTERVAL '1 hour'
      ORDER BY ess.updated_at DESC
      LIMIT 5
    `);
    
    const metrics = metricsResult.rows[0];
    const dbConnections = dbConnectionsResult.rows[0] || { connections: 0, max_connections: 100 };
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: {
          status: dbResponseTime < 100 ? 'healthy' : dbResponseTime < 500 ? 'warning' : 'critical',
          responseTime: dbResponseTime,
          connections: parseInt(dbConnections.connections),
          maxConnections: parseInt(dbConnections.max_connections)
        },
        redis: redisStatus,
        backend: {
          status: 'healthy',
          responseTime: 0,
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'production'
        },
        emailSync: {
          status: syncStatus.isRunning ? 'healthy' : 'warning',
          lastRun: syncStatus.lastSync,
          nextRun: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          queueSize: syncStatus.queueSize || 0
        }
      },
      resources: {
        cpu: {
          usage: Math.round(Math.random() * 40 + 20), // Placeholder - would use actual CPU metrics
          cores: require('os').cpus().length
        },
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
        },
        disk: {
          used: parseInt(diskResult.rows[0].database_size),
          total: 100 * 1024 * 1024 * 1024, // 100GB placeholder
          percentage: Math.round((parseInt(diskResult.rows[0].database_size) / (100 * 1024 * 1024 * 1024)) * 100)
        }
      },
      metrics: {
        totalUsers: parseInt(metrics.totalusers) || 0,
        activeUsers: parseInt(metrics.activeusers) || 0,
        totalEmails: parseInt(metrics.totalemails) || 0,
        emailsToday: parseInt(metrics.emailstoday) || 0,
        apiCalls: 0, // Placeholder
        avgResponseTime: dbResponseTime
      },
      alerts: alertsResult.rows
    });
  } catch (error) {
    console.error('System health error:', error);
    res.status(500).json({ error: 'Failed to fetch system health' });
  }
});

/**
 * Trigger manual sync for all accounts
 */
router.post('/trigger-sync', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Trigger background sync
    backgroundEmailSync.triggerSync();
    
    res.json({
      message: 'Background sync triggered successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Trigger sync error:', error);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

/**
 * Get sync jobs history
 */
router.get('/sync/jobs', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, status = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT 
        esj.*,
        ea.email,
        u.username
      FROM email_sync_jobs esj
      JOIN email_accounts ea ON esj.email_account_id = ea.id
      JOIN users u ON ea.user_id = u.id
    `;

    const params: any[] = [];
    
    if (status) {
      query += ' WHERE esj.status = $1';
      params.push(status);
    }

    query += `
      ORDER BY esj.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    params.push(Number(limit), offset);

    const result = await pool.query(query, params);

    res.json({
      jobs: result.rows
    });
  } catch (error) {
    console.error('Sync jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch sync jobs' });
  }
});

/**
 * Get real-time sync status
 */
router.get('/sync/status', authenticateToken, isAdmin, async (req, res) => {
  try {
    const syncStatus = backgroundEmailSync.getSyncStatus();
    
    // Get currently syncing accounts
    const syncingResult = await pool.query(`
      SELECT 
        ess.email_account_id,
        ea.email,
        ess.folder,
        ess.sync_in_progress,
        ess.last_sync_at,
        ess.error_message
      FROM email_sync_status ess
      JOIN email_accounts ea ON ess.email_account_id = ea.id
      WHERE ess.sync_in_progress = true OR ess.updated_at > NOW() - INTERVAL '5 minutes'
      ORDER BY ess.updated_at DESC
    `);

    res.json({
      backgroundSync: syncStatus,
      activeSyncs: syncingResult.rows
    });
  } catch (error) {
    console.error('Sync status error:', error);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
});

/**
 * System health check
 */
router.get('/health', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Check database connection
    const dbCheck = await pool.query('SELECT NOW()');
    
    // Check Redis connection
    const { createClient } = require('redis');
    const redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    let redisStatus = 'disconnected';
    try {
      await redis.connect();
      await redis.ping();
      redisStatus = 'connected';
      await redis.disconnect();
    } catch (error) {
      redisStatus = 'error';
    }

    // Get system metrics
    const systemResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max_connections
    `);

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        time: dbCheck.rows[0].now,
        connections: systemResult.rows[0]
      },
      redis: {
        status: redisStatus
      },
      backgroundSync: backgroundEmailSync.getSyncStatus().isRunning ? 'running' : 'stopped'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'unhealthy',
      error: (error as any).message 
    });
  }
});

/**
 * Create admin user (one-time setup)
 */
router.post('/setup', async (req, res) => {
  try {
    const { username, email, password, adminSecret } = req.body;

    // Verify admin secret
    if (adminSecret !== process.env.ADMIN_SETUP_SECRET) {
      return res.status(403).json({ error: 'Invalid admin secret' });
    }

    // Check if admin already exists
    const existingAdmin = await pool.query(
      'SELECT id FROM users WHERE is_admin = true LIMIT 1'
    );

    if (existingAdmin.rows.length > 0) {
      return res.status(400).json({ error: 'Admin already exists' });
    }

    // Create admin user
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, is_admin, is_active) VALUES ($1, $2, $3, true, true) RETURNING id, username, email',
      [username, email, passwordHash]
    );

    res.json({
      message: 'Admin user created successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Admin setup error:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

export default router;