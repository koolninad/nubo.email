import { useState, useEffect, useCallback } from 'react';

interface Email {
  id: number;
  uid: string;
  subject: string;
  from_address: string;
  snippet: string;
  date: string;
  is_read: boolean;
  is_starred: boolean;
  attachment_count: number;
  folder: string;
}

interface EmailBody {
  text: string;
  html: string;
}

interface Attachment {
  id: number;
  filename: string;
  content_type: string;
  size: number;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface UseEmailCacheOptions {
  accountId?: number;
  folder: string;
  limit?: number;
  autoSync?: boolean;
  syncInterval?: number;
}

export function useEmailCache({
  accountId,
  folder,
  limit = 50,
  autoSync = true,
  syncInterval = 5 * 60 * 1000, // 5 minutes
}: UseEmailCacheOptions) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    limit,
    offset: 0,
    hasMore: true,
  });

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  });

  // Fetch emails with pagination
  const fetchEmails = useCallback(async (reset: boolean = false) => {
    if (loading || (!pagination.hasMore && !reset)) return;

    setLoading(true);
    setError(null);

    try {
      const offset = reset ? 0 : pagination.offset;
      const params = new URLSearchParams({
        folder,
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (accountId) {
        params.append('account_id', accountId.toString());
      }

      const response = await fetch(`/api/mail-v2/emails?${params}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch emails: ${response.statusText}`);
      }

      const data = await response.json();

      if (reset) {
        setEmails(data.emails);
      } else {
        setEmails(prev => [...prev, ...data.emails]);
      }

      setPagination({
        ...data.pagination,
        offset: offset + data.emails.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch emails');
      console.error('Fetch emails error:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId, folder, limit, pagination.hasMore, pagination.offset]);

  // Sync folder with IMAP
  const syncFolder = useCallback(async () => {
    if (syncing || !accountId) return;

    setSyncing(true);
    
    try {
      const response = await fetch('/api/mail-v2/sync/folder', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ account_id: accountId, folder }),
      });

      if (!response.ok) {
        throw new Error('Failed to sync folder');
      }

      const result = await response.json();
      console.log(`Synced ${result.synced} new emails from ${folder}`);

      // Refresh email list if new emails were synced
      if (result.synced > 0) {
        await fetchEmails(true);
      }
    } catch (err) {
      console.error('Sync folder error:', err);
    } finally {
      setSyncing(false);
    }
  }, [accountId, folder, fetchEmails]);

  // Update email flags
  const updateEmailFlag = useCallback(async (emailId: number, updates: Partial<Email>) => {
    try {
      const response = await fetch(`/api/mail-v2/emails/${emailId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update email');
      }

      // Optimistically update local state
      setEmails(prev => prev.map(email =>
        email.id === emailId ? { ...email, ...updates } : email
      ));

      return true;
    } catch (err) {
      console.error('Update email error:', err);
      return false;
    }
  }, []);

  // Move email to folder
  const moveEmail = useCallback(async (emailId: number, targetFolder: string) => {
    try {
      const response = await fetch(`/api/mail-v2/emails/${emailId}/move`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ targetFolder }),
      });

      if (!response.ok) {
        throw new Error('Failed to move email');
      }

      // Remove from current list
      setEmails(prev => prev.filter(email => email.id !== emailId));
      
      return true;
    } catch (err) {
      console.error('Move email error:', err);
      return false;
    }
  }, []);

  // Delete email
  const deleteEmail = useCallback(async (emailId: number, permanent: boolean = false) => {
    try {
      const response = await fetch(`/api/mail-v2/emails/${emailId}?permanent=${permanent}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to delete email');
      }

      // Remove from list or mark as trash
      if (permanent || folder === 'TRASH') {
        setEmails(prev => prev.filter(email => email.id !== emailId));
      } else {
        setEmails(prev => prev.map(email =>
          email.id === emailId ? { ...email, is_trash: true } : email
        ));
      }

      return true;
    } catch (err) {
      console.error('Delete email error:', err);
      return false;
    }
  }, [folder]);

  // Bulk operations
  const bulkUpdate = useCallback(async (emailIds: number[], updates: Partial<Email>) => {
    const results = await Promise.all(
      emailIds.map(id => updateEmailFlag(id, updates))
    );
    return results.every(result => result);
  }, [updateEmailFlag]);

  // Load more emails
  const loadMore = useCallback(() => {
    if (!loading && pagination.hasMore) {
      fetchEmails(false);
    }
  }, [loading, pagination.hasMore, fetchEmails]);

  // Refresh (reset and reload)
  const refresh = useCallback(() => {
    setEmails([]);
    setPagination(prev => ({ ...prev, offset: 0, hasMore: true }));
    fetchEmails(true);
  }, [fetchEmails]);

  // Auto-sync effect
  useEffect(() => {
    if (autoSync && accountId) {
      syncFolder();
      const interval = setInterval(syncFolder, syncInterval);
      return () => clearInterval(interval);
    }
  }, [autoSync, accountId, syncFolder, syncInterval]);

  // Reset when folder changes
  useEffect(() => {
    refresh();
  }, [folder, accountId]);

  return {
    emails,
    loading,
    syncing,
    error,
    pagination,
    loadMore,
    refresh,
    syncFolder,
    updateEmailFlag,
    moveEmail,
    deleteEmail,
    bulkUpdate,
  };
}

// Hook for fetching email body on demand
export function useEmailBody(emailId: number | null) {
  const [body, setBody] = useState<EmailBody | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
  });

  useEffect(() => {
    if (!emailId) {
      setBody(null);
      setAttachments([]);
      return;
    }

    const fetchEmailDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch body
        const bodyResponse = await fetch(`/api/mail-v2/emails/${emailId}/body`, {
          headers: getAuthHeaders(),
        });

        if (!bodyResponse.ok) {
          throw new Error('Failed to fetch email body');
        }

        const bodyData = await bodyResponse.json();
        setBody(bodyData);

        // Fetch attachments
        const attachResponse = await fetch(`/api/mail-v2/emails/${emailId}/attachments`, {
          headers: getAuthHeaders(),
        });

        if (!attachResponse.ok) {
          throw new Error('Failed to fetch attachments');
        }

        const attachData = await attachResponse.json();
        setAttachments(attachData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch email details');
        console.error('Fetch email details error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmailDetails();
  }, [emailId]);

  const downloadAttachment = useCallback(async (attachmentId: number, filename: string) => {
    try {
      const response = await fetch(`/api/mail-v2/attachments/${attachmentId}/download`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to download attachment');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return true;
    } catch (err) {
      console.error('Download attachment error:', err);
      return false;
    }
  }, []);

  return {
    body,
    attachments,
    loading,
    error,
    downloadAttachment,
  };
}

// Hook for sync status monitoring
export function useSyncStatus(accountId?: number) {
  const [syncStatus, setSyncStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
  });

  const fetchSyncStatus = useCallback(async () => {
    setLoading(true);
    
    try {
      const params = accountId ? `?account_id=${accountId}` : '';
      const response = await fetch(`/api/mail-v2/sync/status${params}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sync status');
      }

      const data = await response.json();
      setSyncStatus(data);
    } catch (err) {
      console.error('Fetch sync status error:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [fetchSyncStatus]);

  return {
    syncStatus,
    loading,
    refresh: fetchSyncStatus,
  };
}