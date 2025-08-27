'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, Paperclip, Star, Archive, Trash2, Spam, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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
  account_email: string;
}

interface EmailListProps {
  accountId?: number;
  folder: string;
  onEmailSelect: (email: Email) => void;
  selectedEmailId?: number;
}

export default function EmailList({ accountId, folder, onEmailSelect, selectedEmailId }: EmailListProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 50;
  const observerTarget = useRef<HTMLDivElement>(null);

  // Fetch emails with pagination
  const fetchEmails = useCallback(async (reset: boolean = false) => {
    if (loading || (!hasMore && !reset)) return;

    setLoading(true);
    const currentOffset = reset ? 0 : offset;

    try {
      const params = new URLSearchParams({
        folder,
        limit: limit.toString(),
        offset: currentOffset.toString(),
      });
      
      if (accountId) {
        params.append('account_id', accountId.toString());
      }

      const response = await fetch(`/api/mail-v2/emails?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch emails');

      const data = await response.json();
      
      if (reset) {
        setEmails(data.emails);
        setOffset(limit);
      } else {
        setEmails(prev => [...prev, ...data.emails]);
        setOffset(prev => prev + limit);
      }

      setTotal(data.pagination.total);
      setHasMore(data.pagination.hasMore);
    } catch (error) {
      console.error('Failed to fetch emails:', error);
    } finally {
      setLoading(false);
    }
  }, [folder, accountId, offset, hasMore, loading]);

  // Sync folder with IMAP
  const syncFolder = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/mail-v2/sync/folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ account_id: accountId, folder }),
      });

      if (!response.ok) throw new Error('Failed to sync folder');

      const result = await response.json();
      console.log(`Synced ${result.synced} new emails`);
      
      // Refresh email list
      await fetchEmails(true);
    } catch (error) {
      console.error('Failed to sync folder:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Update email flags
  const updateEmailFlag = async (emailId: number, updates: any) => {
    try {
      const response = await fetch(`/api/mail-v2/emails/${emailId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update email');

      // Update local state
      setEmails(prev => prev.map(email => 
        email.id === emailId ? { ...email, ...updates } : email
      ));
    } catch (error) {
      console.error('Failed to update email:', error);
    }
  };

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchEmails();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [fetchEmails, hasMore, loading]);

  // Reset and fetch when folder changes
  useEffect(() => {
    setEmails([]);
    setOffset(0);
    setHasMore(true);
    fetchEmails(true);
  }, [folder, accountId]);

  // Auto-sync on mount and periodically
  useEffect(() => {
    syncFolder();
    const interval = setInterval(syncFolder, 5 * 60 * 1000); // Sync every 5 minutes
    return () => clearInterval(interval);
  }, [folder, accountId]);

  const handleStarToggle = (e: React.MouseEvent, email: Email) => {
    e.stopPropagation();
    updateEmailFlag(email.id, { is_starred: !email.is_starred });
  };

  const handleArchive = (e: React.MouseEvent, email: Email) => {
    e.stopPropagation();
    updateEmailFlag(email.id, { is_archived: true });
  };

  const handleDelete = (e: React.MouseEvent, email: Email) => {
    e.stopPropagation();
    updateEmailFlag(email.id, { is_trash: true });
  };

  const handleSpam = (e: React.MouseEvent, email: Email) => {
    e.stopPropagation();
    updateEmailFlag(email.id, { is_spam: true });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-lg font-semibold capitalize">{folder.toLowerCase()}</h2>
          <p className="text-sm text-gray-500">{total} messages</p>
        </div>
        <button
          onClick={() => syncFolder()}
          disabled={syncing}
          className={`p-2 rounded-lg hover:bg-gray-100 ${syncing ? 'animate-spin' : ''}`}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto">
        {emails.map((email) => (
          <div
            key={email.id}
            onClick={() => {
              onEmailSelect(email);
              if (!email.is_read) {
                updateEmailFlag(email.id, { is_read: true });
              }
            }}
            className={`
              p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors
              ${selectedEmailId === email.id ? 'bg-blue-50' : ''}
              ${!email.is_read ? 'font-semibold bg-white' : 'bg-gray-50'}
            `}
          >
            <div className="flex items-start justify-between mb-1">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Mail className={`h-4 w-4 ${!email.is_read ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className="text-sm truncate">{email.from_address}</span>
                  {email.attachment_count > 0 && (
                    <Paperclip className="h-3 w-3 text-gray-400" />
                  )}
                </div>
                <h3 className="text-sm mt-1 truncate">{email.subject || '(No subject)'}</h3>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{email.snippet}</p>
              </div>
              <div className="flex flex-col items-end gap-2 ml-2">
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {formatDistanceToNow(new Date(email.date), { addSuffix: true })}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => handleStarToggle(e, email)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <Star 
                      className={`h-3 w-3 ${email.is_starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} 
                    />
                  </button>
                  {folder !== 'ARCHIVE' && (
                    <button
                      onClick={(e) => handleArchive(e, email)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <Archive className="h-3 w-3 text-gray-400" />
                    </button>
                  )}
                  {folder !== 'TRASH' && (
                    <button
                      onClick={(e) => handleDelete(e, email)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <Trash2 className="h-3 w-3 text-gray-400" />
                    </button>
                  )}
                  {folder !== 'SPAM' && (
                    <button
                      onClick={(e) => handleSpam(e, email)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <Spam className="h-3 w-3 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="p-4 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            <p className="text-sm text-gray-500 mt-2">Loading more emails...</p>
          </div>
        )}

        {/* No more emails */}
        {!hasMore && emails.length > 0 && (
          <div className="p-4 text-center text-sm text-gray-500">
            No more emails to load
          </div>
        )}

        {/* Empty state */}
        {!loading && emails.length === 0 && (
          <div className="p-8 text-center">
            <Mail className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No emails in {folder.toLowerCase()}</p>
          </div>
        )}

        {/* Intersection observer target */}
        <div ref={observerTarget} className="h-1" />
      </div>
    </div>
  );
}