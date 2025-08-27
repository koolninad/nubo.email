import { pool } from '../db/pool';
import { EmailCacheService } from './emailCache';
import * as cron from 'node-cron';

export class BackgroundJobService {
  private emailCache: EmailCacheService;
  private syncJobs: Map<string, cron.ScheduledTask>;

  constructor() {
    this.emailCache = new EmailCacheService();
    this.syncJobs = new Map();
  }

  /**
   * Initialize all background jobs
   */
  initialize() {
    // Sync all accounts every 5 minutes
    this.scheduleSyncJob();
    
    // Cleanup expired data daily at 2 AM
    this.scheduleCleanupJob();
    
    // Process pending sync jobs every minute
    this.processPendingSyncJobs();
    
    console.log('Background jobs initialized');
  }

  /**
   * Schedule email sync for all accounts
   */
  private scheduleSyncJob() {
    // Run every 5 minutes
    const task = cron.schedule('*/5 * * * *', async () => {
      console.log('Running scheduled email sync...');
      
      try {
        // Get all active email accounts
        const accountsResult = await pool.query(
          `SELECT DISTINCT ea.* 
           FROM email_accounts ea
           WHERE ea.is_active = true`
        );

        for (const account of accountsResult.rows) {
          // Check if sync is already in progress
          const syncStatus = await pool.query(
            `SELECT COUNT(*) as count 
             FROM email_sync_status 
             WHERE email_account_id = $1 AND sync_in_progress = true`,
            [account.id]
          );

          if (syncStatus.rows[0].count === 0) {
            // Start sync for this account
            this.syncAccountInBackground(account);
          }
        }
      } catch (error) {
        console.error('Scheduled sync failed:', error);
      }
    });

    this.syncJobs.set('main-sync', task);
    task.start();
  }

  /**
   * Sync single account in background
   */
  private async syncAccountInBackground(account: any) {
    try {
      // Create sync job record
      const jobResult = await pool.query(
        `INSERT INTO email_sync_jobs (email_account_id, job_type, status, started_at)
         VALUES ($1, 'PARTIAL_SYNC', 'running', CURRENT_TIMESTAMP)
         RETURNING id`,
        [account.id]
      );
      
      const jobId = jobResult.rows[0].id;

      // Sync main folders
      const folders = ['INBOX', 'SENT', 'DRAFTS'];
      const results = [];

      for (const folder of folders) {
        try {
          // Mark folder as syncing
          await pool.query(
            `INSERT INTO email_sync_status (email_account_id, folder, sync_in_progress)
             VALUES ($1, $2, true)
             ON CONFLICT (email_account_id, folder)
             DO UPDATE SET sync_in_progress = true, updated_at = CURRENT_TIMESTAMP`,
            [account.id, folder]
          );

          // Sync folder (fetch only new messages)
          const result = await this.emailCache.syncFolderHeaders(account, folder, 50);
          results.push({ folder, ...result });

          // Mark folder sync complete
          await pool.query(
            `UPDATE email_sync_status 
             SET sync_in_progress = false, updated_at = CURRENT_TIMESTAMP
             WHERE email_account_id = $1 AND folder = $2`,
            [account.id, folder]
          );
        } catch (error: any) {
          console.error(`Failed to sync ${folder} for account ${account.id}:`, error);
          
          // Mark folder sync failed
          await pool.query(
            `UPDATE email_sync_status 
             SET sync_in_progress = false, error_message = $1, updated_at = CURRENT_TIMESTAMP
             WHERE email_account_id = $2 AND folder = $3`,
            [error.message, account.id, folder]
          );
        }
      }

      // Update job status
      await pool.query(
        `UPDATE email_sync_jobs 
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP, metadata = $1
         WHERE id = $2`,
        [JSON.stringify({ results }), jobId]
      );

      console.log(`Background sync completed for account ${account.id}`);
    } catch (error: any) {
      console.error(`Background sync failed for account ${account.id}:`, error);
    }
  }

  /**
   * Schedule cleanup job for expired data
   */
  private scheduleCleanupJob() {
    // Run daily at 2 AM
    const task = cron.schedule('0 2 * * *', async () => {
      console.log('Running cleanup job...');
      
      try {
        await this.emailCache.cleanupExpiredData();
        
        // Also cleanup old sync jobs
        await pool.query(
          `DELETE FROM email_sync_jobs 
           WHERE completed_at < CURRENT_TIMESTAMP - INTERVAL '7 days'`
        );
        
        console.log('Cleanup completed successfully');
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    });

    this.syncJobs.set('cleanup', task);
    task.start();
  }

  /**
   * Process pending sync jobs
   */
  private processPendingSyncJobs() {
    // Check for pending jobs every minute
    const task = cron.schedule('* * * * *', async () => {
      try {
        // Get pending jobs
        const pendingJobs = await pool.query(
          `SELECT * FROM email_sync_jobs 
           WHERE status = 'pending' 
           ORDER BY created_at ASC 
           LIMIT 5`
        );

        for (const job of pendingJobs.rows) {
          // Process job based on type
          switch (job.job_type) {
            case 'FULL_SYNC':
              await this.processFullSyncJob(job);
              break;
            case 'FOLDER_SYNC':
              await this.processFolderSyncJob(job);
              break;
            case 'CLEANUP':
              await this.processCleanupJob(job);
              break;
          }
        }
      } catch (error) {
        console.error('Failed to process pending jobs:', error);
      }
    });

    this.syncJobs.set('job-processor', task);
    task.start();
  }

  /**
   * Process full sync job
   */
  private async processFullSyncJob(job: any) {
    try {
      // Update job status
      await pool.query(
        `UPDATE email_sync_jobs 
         SET status = 'running', started_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [job.id]
      );

      // Get account details
      const accountResult = await pool.query(
        'SELECT * FROM email_accounts WHERE id = $1',
        [job.email_account_id]
      );

      if (accountResult.rows.length === 0) {
        throw new Error('Account not found');
      }

      const account = accountResult.rows[0];

      // Sync all folders
      const results = await this.emailCache.syncAllFolders(account);

      // Update job status
      await pool.query(
        `UPDATE email_sync_jobs 
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP, metadata = $1
         WHERE id = $2`,
        [JSON.stringify({ results }), job.id]
      );

      console.log(`Full sync job ${job.id} completed`);
    } catch (error: any) {
      console.error(`Full sync job ${job.id} failed:`, error);
      
      await pool.query(
        `UPDATE email_sync_jobs 
         SET status = 'failed', error_message = $1, completed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [error.message, job.id]
      );
    }
  }

  /**
   * Process folder sync job
   */
  private async processFolderSyncJob(job: any) {
    try {
      await pool.query(
        `UPDATE email_sync_jobs 
         SET status = 'running', started_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [job.id]
      );

      const accountResult = await pool.query(
        'SELECT * FROM email_accounts WHERE id = $1',
        [job.email_account_id]
      );

      if (accountResult.rows.length === 0) {
        throw new Error('Account not found');
      }

      const account = accountResult.rows[0];
      const folder = job.folder || 'INBOX';

      const result = await this.emailCache.syncFolderHeaders(account, folder);

      await pool.query(
        `UPDATE email_sync_jobs 
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP, metadata = $1
         WHERE id = $2`,
        [JSON.stringify({ result }), job.id]
      );

      console.log(`Folder sync job ${job.id} completed`);
    } catch (error: any) {
      console.error(`Folder sync job ${job.id} failed:`, error);
      
      await pool.query(
        `UPDATE email_sync_jobs 
         SET status = 'failed', error_message = $1, completed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [error.message, job.id]
      );
    }
  }

  /**
   * Process cleanup job
   */
  private async processCleanupJob(job: any) {
    try {
      await pool.query(
        `UPDATE email_sync_jobs 
         SET status = 'running', started_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [job.id]
      );

      await this.emailCache.cleanupExpiredData();

      await pool.query(
        `UPDATE email_sync_jobs 
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [job.id]
      );

      console.log(`Cleanup job ${job.id} completed`);
    } catch (error: any) {
      console.error(`Cleanup job ${job.id} failed:`, error);
      
      await pool.query(
        `UPDATE email_sync_jobs 
         SET status = 'failed', error_message = $1, completed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [error.message, job.id]
      );
    }
  }

  /**
   * Stop all background jobs
   */
  stop() {
    for (const [name, task] of this.syncJobs) {
      task.stop();
      console.log(`Stopped job: ${name}`);
    }
    this.syncJobs.clear();
  }

  /**
   * Create a manual sync job
   */
  async createSyncJob(accountId: number, jobType: string, folder?: string) {
    const result = await pool.query(
      `INSERT INTO email_sync_jobs (email_account_id, job_type, status, folder)
       VALUES ($1, $2, 'pending', $3)
       RETURNING id`,
      [accountId, jobType, folder]
    );
    
    return result.rows[0].id;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: number) {
    const result = await pool.query(
      'SELECT * FROM email_sync_jobs WHERE id = $1',
      [jobId]
    );
    
    return result.rows[0] || null;
  }
}