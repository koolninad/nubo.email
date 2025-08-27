import { pool } from './pool';
import * as fs from 'fs';
import * as path from 'path';

interface Migration {
  id: number;
  filename: string;
  executed_at?: Date;
}

export class DatabaseMigrator {
  private migrationsPath: string;

  constructor() {
    this.migrationsPath = path.join(__dirname, '../../migrations');
  }

  async initialize() {
    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async runMigrations() {
    await this.initialize();

    // Get list of migration files
    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Get executed migrations
    const result = await pool.query('SELECT filename FROM migrations');
    const executed = new Set(result.rows.map((row: any) => row.filename));

    // Run pending migrations
    for (const file of files) {
      if (!executed.has(file)) {
        console.log(`Running migration: ${file}`);
        await this.runMigration(file);
      }
    }

    console.log('All migrations completed successfully');
  }

  private async runMigration(filename: string) {
    const filepath = path.join(this.migrationsPath, filename);
    const sql = fs.readFileSync(filepath, 'utf8');

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Execute migration
      await client.query(sql);
      
      // Record migration
      await client.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [filename]
      );
      
      await client.query('COMMIT');
      console.log(`✓ Migration ${filename} completed`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`✗ Migration ${filename} failed:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async status() {
    await this.initialize();

    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    const result = await pool.query(
      'SELECT filename, executed_at FROM migrations ORDER BY executed_at'
    );
    
    const executed = new Map(
      result.rows.map((row: any) => [row.filename, row.executed_at])
    );

    console.log('\nMigration Status:');
    console.log('=================');
    
    for (const file of files) {
      const executedAt = executed.get(file);
      if (executedAt) {
        console.log(`✓ ${file} (executed: ${executedAt})`);
      } else {
        console.log(`✗ ${file} (pending)`);
      }
    }
  }

  async rollback(steps: number = 1) {
    // This is a simplified rollback - in production you'd want down migrations
    const result = await pool.query(
      'SELECT filename FROM migrations ORDER BY executed_at DESC LIMIT $1',
      [steps]
    );

    if (result.rows.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    console.warn(`Rolling back ${result.rows.length} migration(s)...`);
    console.warn('Note: This only removes the migration record, not the schema changes');
    
    for (const row of result.rows as any[]) {
      await pool.query('DELETE FROM migrations WHERE filename = $1', [row.filename]);
      console.log(`Rolled back: ${row.filename}`);
    }
  }
}

// CLI interface
if (require.main === module) {
  const migrator = new DatabaseMigrator();
  const command = process.argv[2];

  (async () => {
    try {
      switch (command) {
        case 'up':
        case 'migrate':
          await migrator.runMigrations();
          break;
        case 'status':
          await migrator.status();
          break;
        case 'rollback':
          const steps = parseInt(process.argv[3]) || 1;
          await migrator.rollback(steps);
          break;
        default:
          console.log('Usage:');
          console.log('  npm run migrate:up     - Run pending migrations');
          console.log('  npm run migrate:status - Show migration status');
          console.log('  npm run migrate:rollback [steps] - Rollback migrations');
      }
    } catch (error) {
      console.error('Migration error:', error);
      process.exit(1);
    } finally {
      await pool.end();
    }
  })();
}