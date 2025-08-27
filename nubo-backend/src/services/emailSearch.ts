import { pool } from '../db/pool';

export interface SearchOptions {
  query: string;
  userId: number;
  accountId?: number;
  folder?: string;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachments?: boolean;
  isUnread?: boolean;
  isStarred?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  emails: any[];
  total: number;
  facets: {
    folders: { folder: string; count: number }[];
    accounts: { email: string; count: number }[];
    dates: { date: string; count: number }[];
  };
}

export class EmailSearchService {
  /**
   * Search emails with full-text search and filters
   */
  async search(options: SearchOptions): Promise<SearchResult> {
    const {
      query,
      userId,
      accountId,
      folder,
      from,
      to,
      subject,
      hasAttachments,
      isUnread,
      isStarred,
      dateFrom,
      dateTo,
      limit = 50,
      offset = 0,
    } = options;

    // Build search query
    let searchQuery = `
      SELECT ce.*, 
             ea.email as account_email,
             ea.display_name,
             (SELECT COUNT(*) FROM email_attachments WHERE email_id = ce.id) as attachment_count,
             ts_rank(
               to_tsvector('english', 
                 COALESCE(ce.subject, '') || ' ' || 
                 COALESCE(ce.from_address, '') || ' ' || 
                 COALESCE(ce.snippet, '') || ' ' ||
                 COALESCE(ce.body_text, '')
               ),
               plainto_tsquery('english', $1)
             ) as rank
      FROM cached_emails ce
      JOIN email_accounts ea ON ce.email_account_id = ea.id
      WHERE ea.user_id = $2
    `;

    const params: any[] = [query || '', userId];
    let paramCount = 3;

    // Add text search condition if query provided
    if (query && query.trim()) {
      searchQuery += ` AND (
        to_tsvector('english', 
          COALESCE(ce.subject, '') || ' ' || 
          COALESCE(ce.from_address, '') || ' ' || 
          COALESCE(ce.snippet, '') || ' ' ||
          COALESCE(ce.body_text, '')
        ) @@ plainto_tsquery('english', $1)
        OR ce.subject ILIKE '%' || $1 || '%'
        OR ce.from_address ILIKE '%' || $1 || '%'
        OR ce.to_address::text ILIKE '%' || $1 || '%'
      )`;
    }

    // Add filters
    if (accountId) {
      searchQuery += ` AND ea.id = $${paramCount}`;
      params.push(accountId);
      paramCount++;
    }

    if (folder) {
      searchQuery += ` AND ce.folder = $${paramCount}`;
      params.push(folder);
      paramCount++;
    }

    if (from) {
      searchQuery += ` AND ce.from_address ILIKE $${paramCount}`;
      params.push(`%${from}%`);
      paramCount++;
    }

    if (to) {
      searchQuery += ` AND ce.to_address::text ILIKE $${paramCount}`;
      params.push(`%${to}%`);
      paramCount++;
    }

    if (subject) {
      searchQuery += ` AND ce.subject ILIKE $${paramCount}`;
      params.push(`%${subject}%`);
      paramCount++;
    }

    if (hasAttachments !== undefined) {
      if (hasAttachments) {
        searchQuery += ` AND (SELECT COUNT(*) FROM email_attachments WHERE email_id = ce.id) > 0`;
      } else {
        searchQuery += ` AND (SELECT COUNT(*) FROM email_attachments WHERE email_id = ce.id) = 0`;
      }
    }

    if (isUnread !== undefined) {
      searchQuery += ` AND ce.is_read = $${paramCount}`;
      params.push(!isUnread); // Invert because we're checking is_read
      paramCount++;
    }

    if (isStarred !== undefined) {
      searchQuery += ` AND ce.is_starred = $${paramCount}`;
      params.push(isStarred);
      paramCount++;
    }

    if (dateFrom) {
      searchQuery += ` AND ce.date >= $${paramCount}`;
      params.push(dateFrom);
      paramCount++;
    }

    if (dateTo) {
      searchQuery += ` AND ce.date <= $${paramCount}`;
      params.push(dateTo);
      paramCount++;
    }

    // Order by relevance if searching, otherwise by date
    if (query && query.trim()) {
      searchQuery += ` ORDER BY rank DESC, ce.date DESC`;
    } else {
      searchQuery += ` ORDER BY ce.date DESC`;
    }

    // Add pagination
    searchQuery += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    // Execute search
    const searchResult = await pool.query(searchQuery, params);

    // Get total count
    let countQuery = searchQuery
      .replace(/SELECT.*FROM/s, 'SELECT COUNT(*) as total FROM')
      .replace(/ORDER BY.*$/s, '');
    
    const countParams = params.slice(0, -2); // Remove limit and offset
    const countResult = await pool.query(countQuery, countParams);

    // Get facets for filtering
    const facets = await this.getFacets(userId, query);

    return {
      emails: searchResult.rows,
      total: parseInt(countResult.rows[0]?.total || 0),
      facets,
    };
  }

  /**
   * Get search facets for filtering
   */
  private async getFacets(userId: number, query?: string): Promise<any> {
    // Get folder distribution
    const folderResult = await pool.query(`
      SELECT ce.folder, COUNT(*) as count
      FROM cached_emails ce
      JOIN email_accounts ea ON ce.email_account_id = ea.id
      WHERE ea.user_id = $1
      GROUP BY ce.folder
      ORDER BY count DESC
    `, [userId]);

    // Get account distribution
    const accountResult = await pool.query(`
      SELECT ea.email, COUNT(*) as count
      FROM cached_emails ce
      JOIN email_accounts ea ON ce.email_account_id = ea.id
      WHERE ea.user_id = $1
      GROUP BY ea.email
      ORDER BY count DESC
    `, [userId]);

    // Get date distribution (last 30 days)
    const dateResult = await pool.query(`
      SELECT DATE(ce.date) as date, COUNT(*) as count
      FROM cached_emails ce
      JOIN email_accounts ea ON ce.email_account_id = ea.id
      WHERE ea.user_id = $1 AND ce.date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(ce.date)
      ORDER BY date DESC
    `, [userId]);

    return {
      folders: folderResult.rows,
      accounts: accountResult.rows,
      dates: dateResult.rows,
    };
  }

  /**
   * Search suggestions based on user's email history
   */
  async getSuggestions(userId: number, prefix: string, limit: number = 10): Promise<string[]> {
    if (!prefix || prefix.length < 2) return [];

    const result = await pool.query(`
      SELECT DISTINCT suggestion FROM (
        SELECT DISTINCT from_address as suggestion
        FROM cached_emails ce
        JOIN email_accounts ea ON ce.email_account_id = ea.id
        WHERE ea.user_id = $1 AND from_address ILIKE $2
        
        UNION
        
        SELECT DISTINCT subject as suggestion
        FROM cached_emails ce
        JOIN email_accounts ea ON ce.email_account_id = ea.id
        WHERE ea.user_id = $1 AND subject ILIKE $2
        
        UNION
        
        SELECT DISTINCT jsonb_array_elements_text(to_address::jsonb) as suggestion
        FROM cached_emails ce
        JOIN email_accounts ea ON ce.email_account_id = ea.id
        WHERE ea.user_id = $1
      ) suggestions
      WHERE suggestion ILIKE $2
      LIMIT $3
    `, [userId, `${prefix}%`, limit]);

    return result.rows.map(row => row.suggestion);
  }

  /**
   * Advanced search with custom filters
   */
  async advancedSearch(userId: number, filters: any): Promise<SearchResult> {
    const searchOptions: SearchOptions = {
      query: filters.query || '',
      userId,
      accountId: filters.accountId,
      folder: filters.folder,
      from: filters.from,
      to: filters.to,
      subject: filters.subject,
      hasAttachments: filters.hasAttachments,
      isUnread: filters.isUnread,
      isStarred: filters.isStarred,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
      limit: filters.limit || 50,
      offset: filters.offset || 0,
    };

    return this.search(searchOptions);
  }

  /**
   * Create search index for better performance
   */
  async createSearchIndex() {
    // Create GIN index for full-text search
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cached_emails_search 
      ON cached_emails 
      USING gin(
        to_tsvector('english', 
          COALESCE(subject, '') || ' ' || 
          COALESCE(from_address, '') || ' ' || 
          COALESCE(snippet, '') || ' ' ||
          COALESCE(body_text, '')
        )
      )
    `);

    // Create indexes for common filter columns
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cached_emails_from ON cached_emails(from_address);
      CREATE INDEX IF NOT EXISTS idx_cached_emails_folder_date ON cached_emails(folder, date DESC);
      CREATE INDEX IF NOT EXISTS idx_cached_emails_account_folder ON cached_emails(email_account_id, folder);
    `);

    console.log('Search indexes created successfully');
  }

  /**
   * Save search query for history/analytics
   */
  async saveSearchQuery(userId: number, query: string, resultCount: number) {
    await pool.query(`
      INSERT INTO search_history (user_id, query, result_count, searched_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    `, [userId, query, resultCount]);
  }

  /**
   * Get popular searches for a user
   */
  async getPopularSearches(userId: number, limit: number = 5): Promise<string[]> {
    const result = await pool.query(`
      SELECT query, COUNT(*) as count
      FROM search_history
      WHERE user_id = $1 AND searched_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY query
      ORDER BY count DESC
      LIMIT $2
    `, [userId, limit]);

    return result.rows.map(row => row.query);
  }
}