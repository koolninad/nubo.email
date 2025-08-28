import * as cron from 'node-cron';
import { pool } from '../db/pool';
import { EmailCacheService, EmailAccount } from './emailCache';
import { emailCacheOAuthService, EmailAccount as OAuthEmailAccount } from './emailCacheOAuth';
import { createClient } from 'redis';

interface EmailSyncJob {
  accountId: number;
  userId: number;
  lastSync: Date | null;
  status: 'idle' | 'syncing' | 'error';
  errorMessage?: string;
}

export class BackgroundEmailSyncService {
  private emailCache: EmailCacheService;
  private redis: ReturnType<typeof createClient>;
  private syncJobs: Map<number, EmailSyncJob> = new Map();
  private isRunning: boolean = false;
  private cronJob: cron.ScheduledTask | null = null;

  constructor() {
    this.emailCache = new EmailCacheService();
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    this.initRedis();
  }

  private async initRedis() {
    try {
      await this.redis.connect();
      console.log('✅ Redis connected for email caching');
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
    }
  }

  /**
   * Start the background sync service
   */
  async start() {
    if (this.isRunning) {
      console.log('Background sync already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting background email sync service');

    // Load all email accounts
    await this.loadEmailAccounts();

    // Run initial sync for all accounts
    await this.syncAllAccounts();

    // Schedule periodic syncs every 5 minutes
    this.cronJob = cron.schedule('*/5 * * * *', async () => {
      console.log('⏰ Running scheduled email sync');
      await this.syncAllAccounts();
    });

    // Schedule deep sync every hour (fetch more emails)
    cron.schedule('0 * * * *', async () => {
      console.log('🔄 Running deep email sync');
      await this.deepSyncAllAccounts();
    });

    // Schedule cleanup of expired data daily at 3 AM
    cron.schedule('0 3 * * *', async () => {
      console.log('🧹 Running email cache cleanup');
      await this.emailCache.cleanupExpiredData();
    });
  }

  /**
   * Stop the background sync service
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('🛑 Background email sync service stopped');
  }

  /**
   * Load all active email accounts from database
   */
  private async loadEmailAccounts() {
    try {
      const result = await pool.query(`
        SELECT ea.*, u.is_active 
        FROM email_accounts ea
        JOIN users u ON ea.user_id = u.id
        WHERE ea.is_active = true AND u.is_active = true
      `);

      this.syncJobs.clear();
      
      for (const account of result.rows) {
        this.syncJobs.set(account.id, {
          accountId: account.id,
          userId: account.user_id,
          lastSync: null,
          status: 'idle'
        });
      }

      console.log(`📧 Loaded ${result.rows.length} email accounts for syncing`);
    } catch (error) {
      console.error('Failed to load email accounts:', error);
    }
  }

  /**
   * Sync all accounts (quick sync - last 50 emails)
   */
  private async syncAllAccounts() {
    const accounts = Array.from(this.syncJobs.values());
    
    // Process accounts in batches to avoid overloading
    const batchSize = 5;
    for (let i = 0; i < accounts.length; i += batchSize) {
      const batch = accounts.slice(i, i + batchSize);
      await Promise.all(
        batch.map(job => this.syncAccount(job.accountId, 50))
      );
    }
  }

  /**
   * Deep sync all accounts (fetch more emails)
   */
  private async deepSyncAllAccounts() {
    const accounts = Array.from(this.syncJobs.values());
    
    // Process accounts sequentially for deep sync to avoid overload
    for (const job of accounts) {
      await this.syncAccount(job.accountId, 200);
    }
  }

  /**
   * Sync a single email account
   */
  private async syncAccount(accountId: number, emailLimit: number = 50) {
    const job = this.syncJobs.get(accountId);
    if (!job || job.status === 'syncing') {
      return;
    }

    try {
      // Update job status
      job.status = 'syncing';
      this.syncJobs.set(accountId, job);

      // Get account details with OAuth info
      const accountResult = await pool.query(`
        SELECT ea.*, ea.oauth_account_id, ea.auth_type
        FROM email_accounts ea
        WHERE ea.id = $1
      `, [accountId]);

      if (accountResult.rows.length === 0) {
        throw new Error('Account not found');
      }

      const account = accountResult.rows[0];
      const emailAccount: any = account; // Can be either EmailAccount or OAuthEmailAccount

      // Determine folders based on provider (Gmail uses different names)
      let folders = ['INBOX', 'SENT', 'DRAFTS'];
      if (account.auth_type === 'OAUTH' && account.imap_host === 'imap.gmail.com') {
        folders = ['INBOX', '[Gmail]/Sent Mail', '[Gmail]/Drafts'];
      }
      const syncResults = [];

      for (const folder of folders) {
        try {
          console.log(`📥 Syncing ${folder} for account ${account.email}`);
          
          // Check cache for recent sync
          const cacheKey = `sync:${accountId}:${folder}`;
          const lastSyncTime = await this.redis.get(cacheKey);
          
          // Skip if synced within last 3 minutes (for quick syncs)
          if (emailLimit === 50 && lastSyncTime) {
            const timeDiff = Date.now() - parseInt(lastSyncTime);
            if (timeDiff < 3 * 60 * 1000) {
              console.log(`⏭️  Skipping ${folder} - recently synced`);
              continue;
            }
          }

          // Use OAuth service for OAuth accounts, regular service for others
          const result = account.auth_type === 'OAUTH' && account.oauth_account_id
            ? await emailCacheOAuthService.syncFolderHeaders(
                emailAccount, 
                folder, 
                emailLimit
              )
            : await this.emailCache.syncFolderHeaders(
                emailAccount, 
                folder, 
                emailLimit
              );
          
          syncResults.push({ folder, ...result });

          // Update cache
          await this.redis.set(cacheKey, Date.now().toString(), { EX: 300 });

          // Cache email bodies for recent emails
          await this.prefetchEmailBodies(accountId, emailAccount, folder, 10);

        } catch (error) {
          console.error(`Failed to sync ${folder}:`, error);
          syncResults.push({ folder, error: (error as any).message });
        }
      }

      // Update job status
      job.status = 'idle';
      job.lastSync = new Date();
      this.syncJobs.set(accountId, job);

      // Log sync results to database
      await pool.query(`
        INSERT INTO email_sync_log (email_account_id, sync_type, sync_results, synced_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `, [accountId, emailLimit === 50 ? 'quick' : 'deep', JSON.stringify(syncResults)]);

      console.log(`✅ Completed sync for account ${account.email}`);

    } catch (error) {
      console.error(`Failed to sync account ${accountId}:`, error);
      
      if (job) {
        job.status = 'error';
        job.errorMessage = (error as any).message;
        this.syncJobs.set(accountId, job);
      }
    }
  }

  /**
   * Prefetch email bodies for recent emails
   */
  private async prefetchEmailBodies(
    accountId: number, 
    account: any, // Can be either EmailAccount or OAuthEmailAccount 
    folder: string, 
    limit: number = 10
  ) {
    try {
      // Get recent emails without cached bodies
      const result = await pool.query(`
        SELECT id, uid, subject
        FROM cached_emails
        WHERE email_account_id = $1 
          AND folder = $2
          AND body_compressed IS NULL
          AND date > NOW() - INTERVAL '7 days'
        ORDER BY date DESC
        LIMIT $3
      `, [accountId, folder, limit]);

      for (const email of result.rows) {
        try {
          console.log(`📄 Prefetching body for: ${email.subject}`);
          // Use OAuth service for OAuth accounts
          if (account.auth_type === 'OAUTH' && account.oauth_account_id) {
            await emailCacheOAuthService.fetchEmailBody(account, folder, email.uid);
          } else {
            await this.emailCache.fetchEmailBody(email.id, account);
          }
          
          // Add small delay to avoid overwhelming IMAP server
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Failed to prefetch body for email ${email.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to prefetch email bodies:', error);
    }
  }

  /**
   * Force sync for a specific user (called when user logs in)
   */
  async syncUserAccounts(userId: number) {
    try {
      const result = await pool.query(`
        SELECT id FROM email_accounts 
        WHERE user_id = $1 AND is_active = true
      `, [userId]);

      for (const account of result.rows) {
        await this.syncAccount(account.id, 100);
      }
    } catch (error) {
      console.error(`Failed to sync user ${userId} accounts:`, error);
    }
  }

  /**
   * Get sync status for monitoring
   */
  getSyncStatus() {
    const status = Array.from(this.syncJobs.values()).map(job => ({
      accountId: job.accountId,
      userId: job.userId,
      status: job.status,
      lastSync: job.lastSync,
      errorMessage: job.errorMessage
    }));

    return {
      isRunning: this.isRunning,
      lastSync: status.length > 0 && status[0].lastSync ? status[0].lastSync.toISOString() : null,
      queueSize: status.filter(s => s.status === 'syncing').length,
      totalAccounts: status.length,
      syncing: status.filter(s => s.status === 'syncing').length,
      errors: status.filter(s => s.status === 'error').length,
      accounts: status
    };
  }

  /**
   * Manually trigger a sync for all accounts
   */
  async triggerSync() {
    console.log('📧 Manual sync triggered');
    // Run the sync immediately
    await this.syncAllAccounts();
  }
}

// Export singleton instance
export const backgroundEmailSync = new BackgroundEmailSyncService();