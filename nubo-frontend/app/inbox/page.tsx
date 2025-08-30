'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { 
  Mail, Plus, Inbox, Star, Archive, Send, Search, 
  RefreshCw, Settings, LogOut, Menu, X, Loader2, Edit2, Trash2, MoreVertical,
  FileText, AlertCircle, Trash, Clock, Reply, ReplyAll, Forward, Printer, RotateCcw, ArrowLeft,
  Paperclip, Download, Eye
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { emailAccountsApi, mailApi } from '@/lib/api';
import api from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EmailAvatar } from '@/components/email/EmailAvatar';
import { EmailHoverActions } from '@/components/email/EmailHoverActions';
import { ComposeEmail } from '@/components/email/ComposeEmail';
import SnoozePopup from '@/components/SnoozePopup';
import TagPopup from '@/components/TagPopup';

export default function InboxPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { 
    emails, emailAccounts, selectedAccountId, selectedEmailId,
    setEmails, setEmailAccounts, setSelectedAccount, setSelectedEmail, logout 
  } = useStore();
  const audioRef = useRef<{ receive: HTMLAudioElement | null; sent: HTMLAudioElement | null }>({
    receive: null,
    sent: null
  });
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Generate a color based on account
  const getAccountColor = (accountOrId: any) => {
    // Handle both account object and ID
    const account = typeof accountOrId === 'object' ? accountOrId : emailAccounts.find((a: any) => a.id === accountOrId);
    
    // Check if it's an OAuth account and use provider-specific colors
    if (account?.auth_type === 'OAUTH' || account?.oauth_account_id) {
      // Try to detect provider from email domain
      const email = account.email_address?.toLowerCase() || '';
      if (email.includes('gmail.com') || email.includes('googlemail.com')) {
        return 'bg-red-500'; // Gmail red
      } else if (email.includes('outlook.com') || email.includes('hotmail.com') || email.includes('live.com')) {
        return 'bg-blue-600'; // Outlook blue
      } else if (email.includes('yahoo.com')) {
        return 'bg-purple-600'; // Yahoo purple
      } else if (email.includes('proton')) {
        return 'bg-purple-700'; // Proton purple
      } else if (email.includes('icloud.com') || email.includes('me.com') || email.includes('mac.com')) {
        return 'bg-gray-600'; // iCloud gray
      } else if (email.includes('zoho')) {
        return 'bg-red-600'; // Zoho red
      }
    }
    
    // Default colors for non-OAuth accounts
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-indigo-500',
    ];
    const accountId = typeof accountOrId === 'number' ? accountOrId : (account?.id || 0);
    return colors[accountId % colors.length];
  };
  
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [realUnreadCounts, setRealUnreadCounts] = useState<{ perAccount: Record<number, number>; total: number }>({ perAccount: {}, total: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmailLocal] = useState<any>(null);
  const [currentView, setCurrentView] = useState('inbox');
  const [hoveredEmailId, setHoveredEmailId] = useState<number | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<Set<number>>(new Set());
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [loadingEmailBody, setLoadingEmailBody] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);
  const PAGE_SIZE = 20;
  
  // Compose Email Modal State
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeReplyTo, setComposeReplyTo] = useState<any>(null);
  const [composeMode, setComposeMode] = useState<'new' | 'reply' | 'replyAll' | 'forward'>('new');
  
  // Add Account Modal State
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({
    email_address: '',
    display_name: '',
    imap_host: '',
    imap_port: '993',
    imap_username: '',
    imap_password: '',
    smtp_host: '',
    smtp_port: '587',
    smtp_username: '',
    smtp_password: ''
  });
  const [addingAccount, setAddingAccount] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [showAccountMenu, setShowAccountMenu] = useState<number | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{success: boolean; message: string} | null>(null);
  const [snoozePopupOpen, setSnoozePopupOpen] = useState(false);
  const [snoozeEmailId, setSnoozeEmailId] = useState<number | null>(null);
  const [tagPopupOpen, setTagPopupOpen] = useState(false);
  const [tagEmailId, setTagEmailId] = useState<number | null>(null);

  // Function to toggle sidebar and save preference
  const toggleSidebar = (open?: boolean) => {
    const newState = open !== undefined ? open : !sidebarOpen;
    setSidebarOpen(newState);
    localStorage.setItem('sidebarOpen', String(newState));
  };

  // Load unread counts from backend
  const loadUnreadCounts = async () => {
    try {
      console.log('Loading unread counts from API...');
      const response = await mailApi.getUnreadCounts();
      console.log('Unread counts response:', response.data);
      if (response && response.data) {
        setRealUnreadCounts(response.data);
      }
    } catch (error) {
      console.error('Failed to load unread counts:', error);
    }
  };

  // Load email accounts - moved here to be available in useEffect
  const loadEmailAccounts = async () => {
    console.log('loadEmailAccounts called');
    try {
      const response = await emailAccountsApi.getAll();
      console.log('Email accounts response:', response.data);
      // Only update accounts if we got a valid response
      if (response && response.data) {
        setEmailAccounts(response.data);
        // If no accounts exist, set loading to false to show welcome screen
        if (response.data.length === 0) {
          console.log('No accounts found');
          setLoading(false);
        } else {
          console.log('Accounts found, calling loadUnreadCounts...');
          // Load real unread counts
          await loadUnreadCounts();
          console.log('loadUnreadCounts completed');
        }
      }
    } catch (error) {
      console.error('Failed to load email accounts:', error);
      // Don't clear accounts on error - keep existing data
      // Only set loading false if we have no accounts at all
      if (emailAccounts.length === 0) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    console.log('Inbox page mounting...');
    
    // Initialize sidebar state from localStorage
    const savedSidebarState = localStorage.getItem('sidebarOpen');
    if (savedSidebarState !== null) {
      setSidebarOpen(savedSidebarState === 'true');
    } else {
      // Default: open on desktop, closed on mobile
      setSidebarOpen(window.innerWidth >= 1024);
    }
    
    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Check both localStorage and sessionStorage for token
    const tokenFromLocal = localStorage.getItem('token');
    const tokenFromSession = sessionStorage.getItem('token');
    const token = tokenFromLocal || tokenFromSession;
    
    const userFromLocal = localStorage.getItem('user');
    const userFromSession = sessionStorage.getItem('user');
    const savedUser = userFromLocal || userFromSession;
    
    console.log('Auth check in inbox:');
    console.log('Token from localStorage:', tokenFromLocal ? 'exists' : 'null');
    console.log('Token from sessionStorage:', tokenFromSession ? 'exists' : 'null');
    console.log('User from localStorage:', userFromLocal ? 'exists' : 'null');
    console.log('User from sessionStorage:', userFromSession ? 'exists' : 'null');
    
    if (!token || !savedUser) {
      console.log('No auth found, redirecting to login...');
      router.push('/login');
      return;
    }
    
    console.log('Auth found, loading inbox...');
    
    // Set up OneSignal external user ID for push notifications
    try {
      const userData = JSON.parse(savedUser);
      const userId = userData.id?.toString() || userData.email;
      if (userId) {
        notificationService.setExternalUserId(userId);
        console.log('Setting OneSignal external user ID:', userId);
      }
    } catch (error) {
      console.error('Failed to parse user data for OneSignal:', error);
    }

    // Initialize audio elements
    audioRef.current.receive = new Audio('/receive.wav');
    audioRef.current.sent = new Audio('/sent.wav');
    
    loadEmailAccounts(); // This will also load unread counts
    
    // TEMPORARY: Force load unread counts directly
    (async () => {
      try {
        console.log('FORCE: Loading unread counts directly...');
        const response = await mailApi.getUnreadCounts();
        console.log('FORCE: Unread counts response:', response.data);
        if (response && response.data) {
          setRealUnreadCounts(response.data);
        }
      } catch (error) {
        console.error('FORCE: Failed to load unread counts:', error);
      }
    })();
    
    // Setup background sync
    const savedSettings = localStorage.getItem('appSettings');
    const settings = savedSettings ? JSON.parse(savedSettings) : { autoSync: true, syncInterval: '5' };
    
    if (settings.autoSync) {
      const interval = parseInt(settings.syncInterval) * 60 * 1000; // Convert minutes to milliseconds
      syncIntervalRef.current = setInterval(() => {
        handleRefresh(true); // Silent refresh
      }, interval);
    }
    
    // Cleanup on unmount
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      window.removeEventListener('resize', () => {});
    };
  }, [router]);

  useEffect(() => {
    console.log('useEffect for loadEmails triggered:', { emailAccountsLength: emailAccounts.length, selectedAccountId, emailsLength: emails.length });
    if (emailAccounts.length > 0 && !selectedAccountId) {
      console.log('Loading emails for all accounts');
      loadEmails();
    } else if (selectedAccountId) {
      console.log('Loading emails for account:', selectedAccountId);
      loadEmails(selectedAccountId);
    }
  }, [emailAccounts, selectedAccountId]);


  // Format date in user's local timezone
  const formatLocalDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return format(date, 'h:mm a');
    } else if (diffDays < 7) {
      return format(date, 'EEE h:mm a');
    } else if (date.getFullYear() === now.getFullYear()) {
      return format(date, 'MMM d');
    } else {
      return format(date, 'MMM d, yyyy');
    }
  };

  const loadEmails = async (accountId?: number, append: boolean = false, silent: boolean = false) => {
    console.log('loadEmails called with:', { accountId, append, silent, emailsCount: emails.length });
    if (!append && !silent) {
      setLoading(true);
      setCurrentOffset(0);
    } else if (append) {
      setLoadingMore(true);
    }
    
    try {
      const response = await mailApi.getInbox({ 
        account_id: accountId, 
        limit: PAGE_SIZE,
        offset: append ? currentOffset : 0
      });
      
      // Ensure response.data is always an array
      const emailData = Array.isArray(response.data) ? response.data : [];
      
      // Check for new emails (for background sync)
      if (!append && safeEmails.length > 0 && emailData.length > 0) {
        const latestEmailId = safeEmails[0]?.id;
        const newEmails = emailData.filter((e: any) => e.id > latestEmailId);
        if (newEmails.length > 0) {
          // Only play sound and show notification for truly new emails
          // (not on initial load or manual refresh)
          if (currentOffset > 0) {
            // Play sound if enabled
            const savedSettings = localStorage.getItem('appSettings');
            const settings = savedSettings ? JSON.parse(savedSettings) : { soundEnabled: true };
            if (settings.soundEnabled && audioRef.current.receive) {
              audioRef.current.receive.play().catch(e => console.log('Audio play failed:', e));
            }
          }
          
          // Show toast if not silent
          if (!silent) {
            showToast(`${newEmails.length} new email${newEmails.length > 1 ? 's' : ''} received`, 'info');
          }
          
          // Show desktop notification if enabled
          const savedSettings2 = localStorage.getItem('appSettings');
          const settings2 = savedSettings2 ? JSON.parse(savedSettings2) : { desktopNotifications: false };
          if (settings2.desktopNotifications && Notification.permission === 'granted') {
            const latestEmail = newEmails[0];
            new Notification('New Email', {
              body: `From: ${latestEmail.from_name || latestEmail.from_address}\nSubject: ${latestEmail.subject}`,
              icon: '/icon.png',
              tag: 'new-email'
            });
          }
        }
      }
      
      if (append) {
        // Ensure we're working with arrays when appending
        const currentEmails = Array.isArray(emails) ? emails : [];
        setEmails([...currentEmails, ...emailData]);
        setCurrentOffset(currentOffset + PAGE_SIZE);
      } else {
        // Always set as an array
        setEmails(emailData);
        setCurrentOffset(PAGE_SIZE);
      }
      
      setHasMore(emailData.length === PAGE_SIZE);
    } catch (error) {
      console.error('Failed to load emails:', error);
      // Ensure emails remains an array even on error
      if (!Array.isArray(emails)) {
        setEmails([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  
  const loadMoreEmails = () => {
    if (!loadingMore && hasMore) {
      loadEmails(selectedAccountId || undefined, true);
    }
  };

  const syncEmails = async (folderType?: string) => {
    if (!emailAccounts.length) {
      setAddAccountOpen(true);
      return;
    }
    
    setSyncing(true);
    try {
      const accountsToSync = selectedAccountId 
        ? emailAccounts.filter(a => a.id === selectedAccountId)
        : emailAccounts;
      
      for (const account of accountsToSync) {
        if (folderType) {
          // Sync specific folder
          try {
            await api.post(`/mail/sync/${account.id}`, { folder: folderType });
          } catch (error) {
            console.error(`Failed to sync ${folderType} folder:`, error);
          }
        } else {
          // Sync all folders automatically
          const folders = ['INBOX', 'SENT', 'DRAFTS', 'SPAM', 'TRASH'];
          for (const folder of folders) {
            try {
              await api.post(`/mail/sync/${account.id}`, { folder });
            } catch (error) {
              console.error(`Failed to sync ${folder}:`, error);
            }
          }
        }
      }
      await loadEmails(selectedAccountId || undefined);
    } catch (error) {
      console.error('Failed to sync emails:', error);
    } finally {
      setSyncing(false);
    }
  };

  const markAsRead = async (emailId: number) => {
    try {
      // Update the backend first
      await mailApi.update(emailId, { is_read: true });
      
      // Refresh unread counts
      loadUnreadCounts();
      
      // Only update the emails array if the email exists and is not already read
      setEmails(prevEmails => {
        if (!Array.isArray(prevEmails)) return prevEmails;
        
        const emailIndex = prevEmails.findIndex(e => e.id === emailId);
        if (emailIndex === -1 || prevEmails[emailIndex].is_read) {
          // Email not found or already read, no update needed
          return prevEmails;
        }
        
        // Create a new array only when necessary
        const newEmails = [...prevEmails];
        newEmails[emailIndex] = { ...newEmails[emailIndex], is_read: true };
        return newEmails;
      });
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const toggleStar = async (emailId: number, isStarred: boolean) => {
    try {
      await mailApi.update(emailId, { is_starred: !isStarred });
      setEmails(prevEmails => {
        const currentEmails = Array.isArray(prevEmails) ? prevEmails : [];
        return currentEmails.map(e => e.id === emailId ? { ...e, is_starred: !isStarred } : e);
      });
      // Update selectedEmail if it's the one being toggled
      if (selectedEmail && selectedEmail.id === emailId) {
        setSelectedEmailLocal({ ...selectedEmail, is_starred: !isStarred });
      }
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  };

  const archiveEmail = async (emailId: number) => {
    try {
      // Immediately update UI for instant feedback
      if (currentView === 'archive') {
        // If we're in archive, just update the flag
        setEmails(safeEmails.map(e => e.id === emailId ? { ...e, is_archived: true } : e));
      } else {
        // Otherwise remove from current view
        setEmails(safeEmails.filter(e => e.id !== emailId));
      }
      
      // Clear selected email if it was archived
      if (selectedEmailId === emailId) {
        setSelectedEmailLocal(null);
      }
      
      // Then update in background
      await mailApi.update(emailId, { is_archived: true });
    } catch (error) {
      console.error('Failed to archive email:', error);
      // Reload on error
      await loadEmails(selectedAccountId || undefined);
    }
  };
  
  const unarchiveEmail = async (emailId: number) => {
    try {
      // Immediately remove from archive view
      setEmails(safeEmails.filter(e => e.id !== emailId));
      
      // Clear selected email if it was unarchived
      if (selectedEmailId === emailId) {
        setSelectedEmailLocal(null);
      }
      
      // Then update in background
      await mailApi.update(emailId, { is_archived: false });
    } catch (error) {
      console.error('Failed to unarchive email:', error);
      // Reload on error
      await loadEmails(selectedAccountId || undefined);
    }
  };
  
  const markAsSpam = async (emailId: number) => {
    try {
      // Immediately update UI
      if (currentView === 'spam') {
        setEmails(safeEmails.map(e => e.id === emailId ? { ...e, is_spam: true } : e));
      } else {
        setEmails(safeEmails.filter(e => e.id !== emailId));
      }
      
      // Clear selected email if it was marked as spam
      if (selectedEmailId === emailId) {
        setSelectedEmailLocal(null);
      }
      
      // Then update in background
      await mailApi.update(emailId, { is_spam: true });
      showToast('Email marked as spam', 'info');
    } catch (error) {
      console.error('Failed to mark as spam:', error);
      showToast('Failed to mark as spam', 'error');
      await loadEmails(selectedAccountId || undefined);
    }
  };
  
  const unmarkAsSpam = async (emailId: number) => {
    try {
      // Update the email to remove spam flag
      await mailApi.update(emailId, { is_spam: false });
      
      // If in spam view, remove from list
      if (currentView === 'spam') {
        setEmails(safeEmails.filter(e => e.id !== emailId));
        if (selectedEmailId === emailId) {
          setSelectedEmailLocal(null);
        }
      } else {
        // Otherwise just update the flag
        setEmails(safeEmails.map(e => e.id === emailId ? { ...e, is_spam: false } : e));
        if (selectedEmail && selectedEmail.id === emailId) {
          setSelectedEmailLocal({ ...selectedEmail, is_spam: false });
        }
      }
      
      showToast('Email unmarked as spam', 'success');
    } catch (error) {
      console.error('Failed to unmark as spam:', error);
      showToast('Failed to unmark as spam', 'error');
      await loadEmails(selectedAccountId || undefined);
    }
  };
  
  const deleteAllTrash = async () => {
    const confirmDelete = confirm('Are you sure you want to permanently delete all emails in trash? This action cannot be undone.');
    if (!confirmDelete) return;
    
    try {
      showToast('Deleting all trash emails...', 'info');
      
      // Get all trash emails
      const trashEmails = safeEmails.filter(e => e.is_trash);
      
      // Delete each email permanently (this would need a backend API endpoint)
      for (const email of trashEmails) {
        await fetch(`/api/mail/${email.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`,
          },
        });
      }
      
      // Clear the UI
      setEmails(safeEmails.filter(e => !e.is_trash));
      setSelectedEmailLocal(null);
      
      showToast(`Permanently deleted ${trashEmails.length} emails`, 'success');
    } catch (error) {
      console.error('Failed to delete all trash:', error);
      showToast('Failed to delete all trash emails', 'error');
      await loadEmails(selectedAccountId || undefined);
    }
  };
  
  const deleteAllSpam = async () => {
    const confirmDelete = confirm('Are you sure you want to move all spam emails to trash?');
    if (!confirmDelete) return;
    
    try {
      showToast('Moving all spam to trash...', 'info');
      
      // Get all spam emails
      const spamEmails = safeEmails.filter(e => e.is_spam && !e.is_trash);
      
      // Move each to trash
      for (const email of spamEmails) {
        await mailApi.update(email.id, { is_trash: true, is_spam: false });
      }
      
      // Update the UI
      if (currentView === 'spam') {
        setEmails(safeEmails.filter(e => !e.is_spam || e.is_trash));
      } else {
        setEmails(safeEmails.map(e => 
          e.is_spam && !e.is_trash 
            ? { ...e, is_trash: true, is_spam: false }
            : e
        ));
      }
      setSelectedEmailLocal(null);
      
      showToast(`Moved ${spamEmails.length} emails to trash`, 'success');
    } catch (error) {
      console.error('Failed to delete all spam:', error);
      showToast('Failed to delete all spam emails', 'error');
      await loadEmails(selectedAccountId || undefined);
    }
  };

  const deleteEmail = async (emailId: number) => {
    try {
      // Immediately update UI for instant feedback
      if (currentView === 'trash') {
        // If we're in trash, just update the flag
        setEmails(safeEmails.map(e => e.id === emailId ? { ...e, is_trash: true } : e));
      } else {
        // Otherwise remove from current view
        setEmails(safeEmails.filter(e => e.id !== emailId));
      }
      
      // Clear selected email if it was deleted
      if (selectedEmailId === emailId) {
        setSelectedEmailLocal(null);
      }
      
      // Then update in background
      await mailApi.update(emailId, { is_trash: true });
    } catch (error) {
      console.error('Failed to delete email:', error);
      await loadEmails(selectedAccountId || undefined);
    }
  };
  
  const restoreEmail = async (emailId: number) => {
    try {
      // Update the email to remove from trash
      await mailApi.update(emailId, { is_trash: false });
      // Remove from trash view
      setEmails(safeEmails.filter(e => e.id !== emailId));
      // Clear selected email if it was restored
      if (selectedEmailId === emailId) {
        setSelectedEmailLocal(null);
      }
    } catch (error) {
      console.error('Failed to restore email:', error);
      await loadEmails(selectedAccountId || undefined);
    }
  };

  const toggleRead = async (emailId: number, isRead: boolean) => {
    try {
      await mailApi.update(emailId, { is_read: !isRead });
      setEmails(prevEmails => {
        const currentEmails = Array.isArray(prevEmails) ? prevEmails : [];
        return currentEmails.map(e => e.id === emailId ? { ...e, is_read: !isRead } : e);
      });
    } catch (error) {
      console.error('Failed to toggle read status:', error);
    }
  };

  const openSnoozePopup = (emailId: number) => {
    setSnoozeEmailId(emailId);
    setSnoozePopupOpen(true);
  };

  const openTagPopup = (emailId: number) => {
    setTagEmailId(emailId);
    setTagPopupOpen(true);
  };

  const snoozeEmail = async (emailId: number, snoozedUntil: Date) => {
    try {
      await mailApi.update(emailId, { 
        is_snoozed: true,
        snoozed_until: snoozedUntil.toISOString()
      });
      
      // Remove from current view if not in snoozed view
      if (currentView === 'snoozed') {
        setEmails(safeEmails.map(e => e.id === emailId ? { ...e, is_snoozed: true, snoozed_until: snoozedUntil.toISOString() } : e));
      } else {
        setEmails(safeEmails.filter(e => e.id !== emailId));
      }
      
      // Clear selected email if it was snoozed
      if (selectedEmailId === emailId) {
        setSelectedEmailLocal(null);
      }
      
      showToast(`Email snoozed until ${format(snoozedUntil, 'PPp')}`, 'success');
    } catch (error) {
      console.error('Failed to snooze email:', error);
      showToast('Failed to snooze email', 'error');
    }
  };

  const applyTagsToEmail = async (emailId: number, tags: string[]) => {
    try {
      await mailApi.update(emailId, { 
        labels: tags
      });
      
      // Update email in the list
      setEmails(safeEmails.map(e => e.id === emailId ? { ...e, labels: tags } : e));
      
      // Update selected email if it's the same
      if (selectedEmail && selectedEmail.id === emailId) {
        setSelectedEmailLocal({ ...selectedEmail, labels: tags });
      }
      
      showToast(`Tags updated successfully`, 'success');
    } catch (error) {
      console.error('Failed to apply tags:', error);
      showToast('Failed to apply tags', 'error');
    }
  };

  const labelEmail = async (emailId: number) => {
    openTagPopup(emailId);
    return;
    // Old implementation replaced with custom popup
    const labelInput = prompt(
      `Enter labels (comma-separated)\nCurrent labels: ${currentLabels.join(', ') || 'None'}`,
      currentLabels.join(', ')
    );
    
    if (labelInput !== null) {
      const newLabels = labelInput
        .split(',')
        .map(label => label.trim())
        .filter(label => label.length > 0);
      
      try {
        await mailApi.update(emailId, { labels: newLabels });
        
        // Update local state
        setEmails(safeEmails.map(e => 
          e.id === emailId ? { ...e, labels: newLabels } : e
        ));
        
        // Update selectedEmail if it's the one being labeled
        if (selectedEmail && selectedEmail.id === emailId) {
          setSelectedEmail({ ...selectedEmail, labels: newLabels });
        }
      } catch (error) {
        console.error('Failed to update labels:', error);
      }
    }
  };

  const handleEmailClick = async (email: any) => {
    // Get safe emails inside the function
    const currentEmails = Array.isArray(emails) ? emails : [];
    
    // First check if we have a cached version with body
    const cachedEmail = currentEmails.find(e => e.id === email.id);
    
    if (cachedEmail && (cachedEmail.text_body || cachedEmail.html_body)) {
      // Use cached version if body is already loaded
      setSelectedEmailLocal(cachedEmail);
      setSelectedEmail(cachedEmail.id);
      
      // Mark as read in background (non-blocking)
      if (!cachedEmail.is_read) {
        setTimeout(() => markAsRead(cachedEmail.id), 0);
      }
      return;
    }
    
    // Set selected email immediately with what we have
    setSelectedEmailLocal(email);
    setSelectedEmail(email.id);
    
    // Mark as read in background (non-blocking)
    if (!email.is_read) {
      setTimeout(() => markAsRead(email.id), 0);
    }
    
    // Fetch email body in background if not already loaded
    if (!email.text_body && !email.html_body) {
      setLoadingEmailBody(true);
      
      // Use setTimeout to ensure UI updates immediately
      setTimeout(async () => {
        try {
          const response = await mailApi.getEmailBody(email.id);
          
          // Fetch attachments if the email has them
          let attachments = [];
          if (email.has_attachments) {
            try {
              const attachmentResponse = await api.get(`/mail/emails/${email.id}/attachments`);
              attachments = attachmentResponse.data;
            } catch (error) {
              console.error('Failed to fetch attachments:', error);
            }
          }
          
          const updatedEmail = { ...email, ...response.data, attachments };
          
          // Update only the selected email display
          setSelectedEmailLocal(updatedEmail);
          
          // Update the email in the list in background
          requestAnimationFrame(() => {
            setEmails(prevEmails => {
              // Early return if the array is invalid or empty
              if (!Array.isArray(prevEmails) || prevEmails.length === 0) {
                return prevEmails;
              }
              
              // Find the email to update
              const emailIndex = prevEmails.findIndex(e => e.id === email.id);
              if (emailIndex === -1) {
                return prevEmails;
              }
              
              // Only update if the body was actually fetched
              if (response.data.text_body || response.data.html_body) {
                const newEmails = [...prevEmails];
                newEmails[emailIndex] = { ...newEmails[emailIndex], ...response.data, attachments };
                return newEmails;
              }
              
              return prevEmails;
            });
          });
        } catch (error) {
          console.error('Failed to fetch email body:', error);
          // Show a message if body can't be loaded
          setSelectedEmailLocal({ 
            ...email, 
            text_body: 'Failed to load email content. Please try again.',
            html_body: '<p>Failed to load email content. Please try again.</p>'
          });
        } finally {
          setLoadingEmailBody(false);
        }
      }, 0);
    }
  };


  const handleAddAccount = async () => {
    setAddingAccount(true);
    try {
      if (editingAccountId) {
        // Update existing account
        await emailAccountsApi.update(editingAccountId, accountForm);
      } else {
        // Add new account
        await emailAccountsApi.add(accountForm);
      }
      await loadEmailAccounts();
      setAddAccountOpen(false);
      setEditingAccountId(null);
      setAccountForm({
        email_address: '',
        display_name: '',
        imap_host: '',
        imap_port: '993',
        imap_username: '',
        imap_password: '',
        smtp_host: '',
        smtp_port: '587',
        smtp_username: '',
        smtp_password: ''
      });
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to save account', 'error');
    } finally {
      setAddingAccount(false);
    }
  };
  
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionTestResult(null);
    
    try {
      // Test IMAP connection
      await emailAccountsApi.testConnection({
        ...accountForm,
        test_type: 'both'
      });
      
      setConnectionTestResult({
        success: true,
        message: 'Connection successful! IMAP and SMTP settings are correct.'
      });
    } catch (error: any) {
      setConnectionTestResult({
        success: false,
        message: error.response?.data?.error || 'Connection test failed'
      });
    } finally {
      setTestingConnection(false);
    }
  };
  
  const handleEditAccount = (account: any) => {
    setAccountForm({
      email_address: account.email_address,
      display_name: account.display_name,
      imap_host: account.imap_host,
      imap_port: account.imap_port.toString(),
      imap_username: account.imap_username || account.email_address,
      imap_password: '', // User needs to re-enter password
      smtp_host: account.smtp_host,
      smtp_port: account.smtp_port.toString(),
      smtp_username: account.smtp_username || account.email_address,
      smtp_password: '' // User needs to re-enter password
    });
    setEditingAccountId(account.id);
    setAddAccountOpen(true);
    setShowAccountMenu(null);
  };
  
  const handleDeleteAccount = async (accountId: number) => {
    if (!confirm('Are you sure you want to delete this email account?')) {
      return;
    }
    
    try {
      await emailAccountsApi.delete(accountId);
      await loadEmailAccounts();
      if (selectedAccountId === accountId) {
        setSelectedAccount(null);
      }
      setShowAccountMenu(null);
    } catch (error: any) {
      console.error('Failed to delete account:', error);
      showToast('Failed to delete account', 'error');
    }
  };

  const prefillGmailSettings = () => {
    setAccountForm(prev => ({
      ...prev,
      imap_host: 'imap.gmail.com',
      imap_port: '993',
      smtp_host: 'smtp.gmail.com',
      smtp_port: '587'
    }));
  };

  const handleViewChange = async (view: string) => {
    setCurrentView(view);
    setSelectedEmailLocal(null);
    setSelectedEmail(null);
    
    // Load emails for the new view to ensure we have the right data
    setLoading(true);
    try {
      // For special folders, we need to sync first
      const folderMap: Record<string, string> = {
        'sent': 'SENT',
        'drafts': 'DRAFTS',
        'spam': 'SPAM',
        'trash': 'TRASH',
        'snoozed': 'SNOOZED',
        'archived': 'ARCHIVE'
      };
      
      // If it's a special folder, sync it first
      if (folderMap[view] && selectedAccountId) {
        try {
          await api.post(`/mail/sync/${selectedAccountId}`, { folder: folderMap[view] });
        } catch (error) {
          console.error(`Failed to sync ${view} folder:`, error);
        }
      }
      
      // Load emails for the current view
      await loadEmails(selectedAccountId || undefined);
    } catch (error) {
      console.error('Failed to load emails for view:', view, error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRefresh = async (silent: boolean = false) => {
    if (!silent) {
      setRefreshing(true);
    }
    
    try {
      // Sync all accounts
      for (const account of emailAccounts) {
        try {
          await mailApi.sync(account.id);
          
          // Also sync other important folders
          const foldersToSync = ['SENT', 'DRAFTS', 'SPAM', 'TRASH', 'ARCHIVE'];
          for (const folder of foldersToSync) {
            try {
              await api.post(`/mail/sync/${account.id}`, { folder });
            } catch (error) {
              console.error(`Failed to sync ${folder}:`, error);
            }
          }
        } catch (error) {
          console.error(`Failed to sync account ${account.id}:`, error);
        }
      }
      
      // Reload emails
      await loadEmails(selectedAccountId || undefined, false, silent);
      
      if (!silent) {
        showToast('Emails refreshed successfully', 'success');
      }
    } catch (error) {
      console.error('Failed to refresh emails:', error);
      if (!silent) {
        showToast('Failed to refresh emails', 'error');
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    logout();
    router.push('/login');
  };

  // Helper to ensure emails is always an array
  const safeEmails = Array.isArray(emails) ? emails : [];
  
  // Memoize filtered emails to prevent unnecessary recalculations
  const filteredEmails = useMemo(() => {
    let filtered = safeEmails;
    
    // Filter by selected account first
    if (selectedAccountId) {
      filtered = filtered.filter(e => e.email_account_id === selectedAccountId);
    }
    
    // Filter by view
    if (currentView === 'starred') {
      filtered = filtered.filter(e => e.is_starred && !e.is_archived && !e.is_trash);
    } else if (currentView === 'archived') {
      filtered = filtered.filter(e => e.is_archived && !e.is_trash);
    } else if (currentView === 'sent') {
      // Show emails from the user's email address
      const userEmails = emailAccounts.map(acc => acc.email_address.toLowerCase());
      filtered = filtered.filter(e => 
        userEmails.includes(e.from_address?.toLowerCase()) && !e.is_trash
      );
    } else if (currentView === 'drafts') {
      filtered = filtered.filter(e => e.is_draft && !e.is_trash);
    } else if (currentView === 'spam') {
      filtered = filtered.filter(e => e.is_spam && !e.is_trash);
    } else if (currentView === 'trash') {
      filtered = filtered.filter(e => e.is_trash);
    } else if (currentView === 'snoozed') {
      filtered = filtered.filter(e => e.is_snoozed && !e.is_trash);
    } else if (currentView === 'inbox') {
      // Show non-archived, non-draft, non-spam, non-trash emails in inbox
      filtered = filtered.filter(e => !e.is_archived && !e.is_draft && !e.is_spam && !e.is_trash && !e.is_snoozed);
    }
    
    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(email => 
        email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.from_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.snippet.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  }, [safeEmails, currentView, searchQuery, emailAccounts, selectedAccountId]);

  // Compute counts for navigation pane - use real counts from backend
  const navigationCounts = useMemo(() => {
    // For navigation items, filter by selected account if one is selected
    const emailsToCount = selectedAccountId 
      ? safeEmails.filter(e => e.email_account_id === selectedAccountId)
      : safeEmails;
    
    // Use real unread counts from backend for accuracy
    const perAccountUnread = realUnreadCounts.perAccount || {};
    const totalUnread = realUnreadCounts.total || 0;
    
    console.log('Navigation counts calculation:', {
      realUnreadCounts,
      perAccountUnread,
      totalUnread,
      selectedAccountId
    });
    
    // Calculate inbox count based on selected account
    const inboxUnreadCount = selectedAccountId 
      ? (perAccountUnread[selectedAccountId] || 0)
      : totalUnread;
    
    return {
      inbox: inboxUnreadCount,
      snoozed: emailsToCount.filter(e => e.is_snoozed && !e.is_trash).length,
      sent: emailsToCount.filter(e => {
        const userEmails = emailAccounts.map(acc => acc.email_address.toLowerCase());
        return userEmails.includes(e.from_address?.toLowerCase()) && !e.is_trash;
      }).length,
      drafts: emailsToCount.filter(e => e.is_draft && !e.is_trash).length,
      starred: emailsToCount.filter(e => e.is_starred && !e.is_trash).length,
      archived: emailsToCount.filter(e => e.is_archived && !e.is_trash).length,
      spam: emailsToCount.filter(e => e.is_spam && !e.is_trash).length,
      trash: emailsToCount.filter(e => e.is_trash).length,
      allAccountsUnread: totalUnread,
      perAccountUnread: perAccountUnread
    };
  }, [safeEmails, selectedAccountId, emailAccounts, realUnreadCounts]);

  // Check if this is a brand new user (no accounts have ever been loaded)
  const isNewUser = emailAccounts.length === 0 && !loading && !selectedAccountId;
  
  // Show welcome screen for brand new users with no email accounts
  if (isNewUser && safeEmails.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800 p-4">
        <div className="container mx-auto max-w-6xl py-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-blue-600 dark:bg-blue-500 rounded-2xl flex items-center justify-center">
                <Mail className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
              Welcome to Nubo Email
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Connect your email accounts securely. Choose quick setup with OAuth or manual configuration with IMAP.
            </p>
          </div>

          {/* Quick Setup with OAuth */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6 text-center">
              Add Your First Email Account
            </h2>
            <div className="grid grid-cols-2 gap-6 mb-8 max-w-2xl mx-auto">
              {/* Gmail */}
              <button
                onClick={async () => {
                  try {
                    const response = await api.post('/oauth/welcome/auth/init/google', {
                      redirectUrl: window.location.origin + '/inbox'
                    });
                    if (response.data.authUrl) {
                      window.location.href = response.data.authUrl;
                    }
                  } catch (error) {
                    console.error('Failed to init Google OAuth:', error);
                    showToast('Failed to connect to Gmail', 'error');
                  }
                }}
                className="group bg-white dark:bg-neutral-800 rounded-xl p-8 hover:shadow-lg transition-all hover:scale-105 border-2 border-gray-200 dark:border-neutral-700 hover:border-red-500"
              >
                <img src="/logos/google.svg" alt="Gmail" className="w-16 h-16 mx-auto mb-4" />
                <p className="font-semibold text-lg text-gray-900 dark:text-white">Gmail</p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">OAuth 2.0 • Secure</p>
              </button>

              {/* Outlook */}
              <button
                onClick={async () => {
                  try {
                    const response = await api.post('/oauth/welcome/auth/init/microsoft', {
                      redirectUrl: window.location.origin + '/inbox'
                    });
                    if (response.data.authUrl) {
                      window.location.href = response.data.authUrl;
                    }
                  } catch (error) {
                    console.error('Failed to init Microsoft OAuth:', error);
                    showToast('Failed to connect to Outlook', 'error');
                  }
                }}
                className="group bg-white dark:bg-neutral-800 rounded-xl p-8 hover:shadow-lg transition-all hover:scale-105 border-2 border-gray-200 dark:border-neutral-700 hover:border-blue-500"
              >
                <img src="/logos/outlook.svg" alt="Outlook" className="w-16 h-16 mx-auto mb-4" />
                <p className="font-semibold text-lg text-gray-900 dark:text-white">Outlook</p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">OAuth 2.0 • Secure</p>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative mb-12">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-neutral-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800 text-gray-500 dark:text-gray-400">
                OR
              </span>
            </div>
          </div>

          {/* Manual Setup */}
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Manual Setup with IMAP/SMTP
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Configure any email provider manually with IMAP and SMTP settings
            </p>
            <Button 
              size="lg"
              onClick={() => setAddAccountOpen(true)}
              className="px-8"
            >
              <Settings className="w-5 h-5 mr-2" />
              Manual Email Setup
            </Button>
          </div>

          {/* Security Note */}
          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              🔒 Your credentials are encrypted and never shared with third parties
            </p>
          </div>
        </div>
        
        {/* Add Account Dialog */}
        <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Email Account</DialogTitle>
              <DialogDescription>
                Connect your email account using IMAP/SMTP settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={accountForm.email_address}
                    onChange={(e) => setAccountForm({...accountForm, email_address: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="display">Display Name</Label>
                  <Input
                    id="display"
                    value={accountForm.display_name}
                    onChange={(e) => setAccountForm({...accountForm, display_name: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">IMAP Settings (Incoming Mail)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="imap-host">IMAP Server</Label>
                    <Input
                      id="imap-host"
                      placeholder="imap.gmail.com"
                      value={accountForm.imap_host}
                      onChange={(e) => setAccountForm({...accountForm, imap_host: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="imap-port">Port</Label>
                    <Input
                      id="imap-port"
                      placeholder="993"
                      value={accountForm.imap_port}
                      onChange={(e) => setAccountForm({...accountForm, imap_port: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="imap-user">Username</Label>
                    <Input
                      id="imap-user"
                      value={accountForm.imap_username}
                      onChange={(e) => setAccountForm({...accountForm, imap_username: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="imap-pass">Password</Label>
                    <Input
                      id="imap-pass"
                      type="password"
                      value={accountForm.imap_password}
                      onChange={(e) => setAccountForm({...accountForm, imap_password: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">SMTP Settings (Outgoing Mail)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="smtp-host">SMTP Server</Label>
                    <Input
                      id="smtp-host"
                      placeholder="smtp.gmail.com"
                      value={accountForm.smtp_host}
                      onChange={(e) => setAccountForm({...accountForm, smtp_host: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp-port">Port</Label>
                    <Input
                      id="smtp-port"
                      placeholder="587"
                      value={accountForm.smtp_port}
                      onChange={(e) => setAccountForm({...accountForm, smtp_port: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp-user">Username</Label>
                    <Input
                      id="smtp-user"
                      value={accountForm.smtp_username}
                      onChange={(e) => setAccountForm({...accountForm, smtp_username: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp-pass">Password</Label>
                    <Input
                      id="smtp-pass"
                      type="password"
                      value={accountForm.smtp_password}
                      onChange={(e) => setAccountForm({...accountForm, smtp_password: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              
              {connectionTestResult && (
                <div className={`mt-4 p-3 rounded-lg text-sm relative ${
                  connectionTestResult.success 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  <button
                    onClick={() => setConnectionTestResult(null)}
                    className="absolute top-2 right-2 text-current opacity-70 hover:opacity-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="pr-8">{connectionTestResult.message}</div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleTestConnection}
                disabled={testingConnection || !accountForm.imap_host || !accountForm.smtp_host}
              >
                {testingConnection ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing...</>
                ) : (
                  'Test Connection'
                )}
              </Button>
              <Button onClick={handleAddAccount} disabled={addingAccount}>
                {addingAccount ? 'Adding...' : editingAccountId ? 'Update Account' : 'Add Account'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="h-screen flex relative overflow-hidden">
      
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => toggleSidebar(false)}
        />
      )}
      
      {/* Sidebar - Always takes space on desktop when open */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed lg:static w-64 h-full glass-dark backdrop-blur-2xl border-r border-white/10 flex flex-col z-50 lg:z-auto flex-shrink-0"
          >
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <img src="/logo.png" alt="Nubo" className="w-8 h-8 rounded-lg" />
                  <span className="font-semibold text-white">Nubo</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleSidebar(false)}
                  className="lg:hidden"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <Button 
                className="w-full" 
                size="sm"
                onClick={() => {
                  setComposeReplyTo(null);
                  setComposeMode('new');
                  setComposeOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Compose
              </Button>
              
              <ComposeEmail
                open={composeOpen}
                onClose={() => {
                  setComposeOpen(false);
                  setComposeReplyTo(null);
                  setComposeMode('new');
                }}
                onSend={async (data) => {
                  try {
                    await mailApi.send({
                      account_id: data.from,
                      to: data.to,
                      cc: data.cc,
                      bcc: data.bcc,
                      subject: data.subject,
                      text: data.body.replace(/<[^>]*>/g, ''),
                      html: data.body
                    });
                    
                    // Sync the account that sent the email to update sent folder
                    await mailApi.sync(data.from);
                    await loadEmails(selectedAccountId || undefined);
                    
                    showToast('Email sent successfully!', 'success');
                    // Play sent sound
                    const savedSettings = localStorage.getItem('appSettings');
                    const settings = savedSettings ? JSON.parse(savedSettings) : { soundEnabled: true };
                    if (settings.soundEnabled && audioRef.current.sent) {
                      audioRef.current.sent.play().catch(e => console.log('Audio play failed:', e));
                    }
                  } catch (error: any) {
                    console.error('Failed to send email:', error);
                    showToast(error.response?.data?.error || 'Failed to send email. Please check your SMTP settings.', 'error');
                  }
                }}
                accounts={emailAccounts}
                replyTo={composeReplyTo}
                isReply={composeMode === 'reply' || composeMode === 'replyAll'}
                isForward={composeMode === 'forward'}
              />
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              <button 
                onClick={() => handleViewChange('inbox')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  currentView === 'inbox' ? 'bg-white/[0.08] text-white' : 'text-white/70 hover:bg-white/[0.05]'
                }`}
              >
                <Inbox className="w-4 h-4" />
                <span className="font-medium">Inbox</span>
                {navigationCounts.inbox > 0 && (
                  <span className="ml-auto bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {navigationCounts.inbox}
                  </span>
                )}
              </button>
              <button 
                onClick={() => handleViewChange('snoozed')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  currentView === 'snoozed' ? 'bg-white/[0.08] text-white' : 'text-white/70 hover:bg-white/[0.05]'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Snoozed</span>
                <span className="ml-auto text-xs text-neutral-500">{navigationCounts.snoozed}</span>
              </button>
              <button 
                onClick={() => handleViewChange('sent')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  currentView === 'sent' ? 'bg-white/[0.08] text-white' : 'text-white/70 hover:bg-white/[0.05]'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>Sent</span>
              </button>
              <button 
                onClick={() => handleViewChange('drafts')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  currentView === 'drafts' ? 'bg-white/[0.08] text-white' : 'text-white/70 hover:bg-white/[0.05]'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Drafts</span>
                <span className="ml-auto text-xs text-neutral-500">{navigationCounts.drafts}</span>
              </button>
              <button 
                onClick={() => handleViewChange('starred')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  currentView === 'starred' ? 'bg-white/[0.08] text-white' : 'text-white/70 hover:bg-white/[0.05]'
                }`}
              >
                <Star className="w-4 h-4" />
                <span>Starred</span>
                <span className="ml-auto text-xs text-neutral-500">{navigationCounts.starred}</span>
              </button>
              <button 
                onClick={() => handleViewChange('archived')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left ${
                  currentView === 'archived' ? 'bg-neutral-100 dark:bg-neutral-800' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <Archive className="w-4 h-4" />
                <span>Archive</span>
                <span className="ml-auto text-xs text-neutral-500">{navigationCounts.archived}</span>
              </button>
              <button 
                onClick={() => handleViewChange('spam')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  currentView === 'spam' ? 'bg-white/[0.08] text-white' : 'text-white/70 hover:bg-white/[0.05]'
                }`}
              >
                <AlertCircle className="w-4 h-4" />
                <span>Spam</span>
                <span className="ml-auto text-xs text-neutral-500">{navigationCounts.spam}</span>
              </button>
              <button 
                onClick={() => handleViewChange('trash')}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  currentView === 'trash' ? 'bg-white/[0.08] text-white' : 'text-white/70 hover:bg-white/[0.05]'
                }`}
              >
                <Trash className="w-4 h-4" />
                <span>Trash</span>
                <span className="ml-auto text-xs text-neutral-500">{navigationCounts.trash}</span>
              </button>
            </nav>

            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
              <div className="space-y-2">
                <div className="text-xs font-medium text-neutral-500 mb-2">EMAIL ACCOUNTS</div>
                {/* All Accounts option */}
                {emailAccounts.length > 1 && (
                  <button
                    onClick={() => {
                      setSelectedAccount(null);
                      // Don't close sidebar on desktop, only on mobile
                      if (window.innerWidth < 1024) {
                        toggleSidebar(false);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center space-x-2 ${
                      !selectedAccountId
                        ? 'bg-neutral-100 dark:bg-neutral-800'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
                    <span className="flex-1">All Accounts</span>
                    {navigationCounts.allAccountsUnread > 0 && (
                      <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                        {navigationCounts.allAccountsUnread}
                      </span>
                    )}
                  </button>
                )}
                {emailAccounts.map(account => {
                  // Use pre-calculated unread count for this account
                  const unreadCount = navigationCounts.perAccountUnread[account.id] || 0;
                  
                  return (
                    <div key={account.id} className="relative">
                      <button
                        onClick={() => {
                          setSelectedAccount(account.id);
                          // Don't close sidebar on desktop, only on mobile
                          if (window.innerWidth < 1024) {
                            toggleSidebar(false);
                          }
                        }}
                        className={`w-full text-left px-3 py-2 pr-8 rounded-lg text-sm truncate flex items-center space-x-2 ${
                          selectedAccountId === account.id
                            ? 'bg-neutral-100 dark:bg-neutral-800'
                            : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${getAccountColor(account)}`} />
                        <span className="flex-1 truncate">{account.display_name}</span>
                        {unreadCount > 0 && (
                          <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                            {unreadCount}
                          </span>
                        )}
                      </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAccountMenu(showAccountMenu === account.id ? null : account.id);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded"
                    >
                      <MoreVertical className="w-3 h-3" />
                    </button>
                    {showAccountMenu === account.id && (
                      <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-10">
                        <button
                          onClick={() => handleEditAccount(account)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center space-x-2"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(account.id)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 text-red-600 flex items-center space-x-2"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                    </div>
                  );
                })}
                
                <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      <Plus className="w-3 h-3 mr-2" />
                      Add Account
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[625px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingAccountId ? 'Edit Email Account' : 'Add Email Account'}</DialogTitle>
                      <DialogDescription>
                        {editingAccountId ? 'Update your email account settings.' : 'Connect your email account using IMAP/SMTP settings.'}
                        {editingAccountId && <span className="text-amber-600 block mt-2">Note: You need to re-enter your passwords for security reasons.</span>}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={prefillGmailSettings}
                      >
                        Prefill Gmail Settings
                      </Button>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="email">Email Address</Label>
                          <Input
                            id="email"
                            type="email"
                            value={accountForm.email_address}
                            onChange={(e) => setAccountForm({...accountForm, email_address: e.target.value})}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="display">Display Name</Label>
                          <Input
                            id="display"
                            value={accountForm.display_name}
                            onChange={(e) => setAccountForm({...accountForm, display_name: e.target.value})}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className="font-medium">IMAP Settings (Incoming)</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="imap-host">IMAP Host</Label>
                            <Input
                              id="imap-host"
                              placeholder="imap.gmail.com"
                              value={accountForm.imap_host}
                              onChange={(e) => setAccountForm({...accountForm, imap_host: e.target.value})}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="imap-port">IMAP Port</Label>
                            <Input
                              id="imap-port"
                              placeholder="993"
                              value={accountForm.imap_port}
                              onChange={(e) => setAccountForm({...accountForm, imap_port: e.target.value})}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="imap-user">IMAP Username</Label>
                            <Input
                              id="imap-user"
                              value={accountForm.imap_username}
                              onChange={(e) => setAccountForm({...accountForm, imap_username: e.target.value})}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="imap-pass">IMAP Password</Label>
                            <Input
                              id="imap-pass"
                              type="password"
                              value={accountForm.imap_password}
                              onChange={(e) => setAccountForm({...accountForm, imap_password: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className="font-medium">SMTP Settings (Outgoing)</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="smtp-host">SMTP Host</Label>
                            <Input
                              id="smtp-host"
                              placeholder="smtp.gmail.com"
                              value={accountForm.smtp_host}
                              onChange={(e) => setAccountForm({...accountForm, smtp_host: e.target.value})}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="smtp-port">SMTP Port</Label>
                            <Input
                              id="smtp-port"
                              placeholder="587"
                              value={accountForm.smtp_port}
                              onChange={(e) => setAccountForm({...accountForm, smtp_port: e.target.value})}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="smtp-user">SMTP Username</Label>
                            <Input
                              id="smtp-user"
                              value={accountForm.smtp_username}
                              onChange={(e) => setAccountForm({...accountForm, smtp_username: e.target.value})}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="smtp-pass">SMTP Password</Label>
                            <Input
                              id="smtp-pass"
                              type="password"
                              value={accountForm.smtp_password}
                              onChange={(e) => setAccountForm({...accountForm, smtp_password: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>
                      
                      {connectionTestResult && (
                        <div className={`mt-4 p-3 rounded-lg text-sm relative ${
                          connectionTestResult.success 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          <button
                            onClick={() => setConnectionTestResult(null)}
                            className="absolute top-2 right-2 text-current opacity-70 hover:opacity-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="pr-8">{connectionTestResult.message}</div>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleTestConnection}
                        disabled={testingConnection || !accountForm.imap_host || !accountForm.smtp_host}
                      >
                        {testingConnection ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          'Test Connection'
                        )}
                      </Button>
                      <Button onClick={handleAddAccount} disabled={addingAccount}>
                        {addingAccount ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {editingAccountId ? 'Updating...' : 'Adding...'}
                          </>
                        ) : (
                          editingAccountId ? 'Update Account' : 'Add Account'
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start"
                onClick={() => router.push('/settings')}
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="glass-header px-4 py-3 flex-shrink-0">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleSidebar()}
              className="lg:hidden"
            >
              <Menu className="w-4 h-4" />
            </Button>
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleSidebar(true)}
                className="hidden lg:block"
              >
                <Menu className="w-4 h-4" />
              </Button>
            )}
            <div className="flex-1 max-w-xl relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
              <Input
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full glass-input text-white placeholder:text-white/50"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (selectedAccountId) {
                  const folderMap: Record<string, string> = {
                    'sent': 'SENT',
                    'drafts': 'DRAFTS',
                    'spam': 'SPAM',
                    'trash': 'TRASH'
                  };
                  syncEmails(folderMap[currentView] || undefined);
                } else {
                  handleRefresh(false);
                }
              }}
              disabled={refreshing || syncing}
              title={selectedAccountId ? `Sync ${currentView}` : 'Refresh all'}
            >
              <RefreshCw className={`w-4 h-4 ${(refreshing || syncing) ? 'animate-spin' : ''}`} />
            </Button>
            
            {/* Delete All buttons for Trash and Spam */}
            {currentView === 'trash' && filteredEmails.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteAllTrash}
                className="ml-2"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Empty Trash
              </Button>
            )}
            
            {currentView === 'spam' && filteredEmails.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteAllSpam}
                className="ml-2"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete All Spam
              </Button>
            )}
          </div>
        </header>

        {/* Email Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Email List Panel - Always visible on desktop, full width on mobile when no email selected */}
          <div className={`${selectedEmail ? 'hidden md:block' : 'block'} ${selectedEmail ? 'md:w-[400px] lg:w-[450px]' : 'w-full'} flex-shrink-0 glass backdrop-blur-xl border-r border-white/10 overflow-y-auto transition-all duration-300`}
               onScroll={(e) => {
                 const target = e.target as HTMLDivElement;
                 if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
                   loadMoreEmails();
                 }
               }}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-white/50" />
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Inbox className="w-12 h-12 text-white/30 mb-4" />
                <div className="text-white/60">
                  {currentView === 'sent' ? 'No sent emails' : 
                   currentView === 'starred' ? 'No starred emails' :
                   currentView === 'archived' ? 'No archived emails' :
                   'No emails found'}
                </div>
                {/* Auto-sync in background, no manual sync button needed */}
                {emailAccounts.length === 0 && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setAddAccountOpen(true)}>
                    Add Email Account
                  </Button>
                )}
              </div>
            ) : (
              <>
                {bulkSelectMode && (
                  <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 p-3 flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedEmails.size === filteredEmails.length && filteredEmails.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEmails(new Set(filteredEmails.map(e => e.id)));
                        } else {
                          setSelectedEmails(new Set());
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-neutral-600">
                      {selectedEmails.size} selected
                    </span>
                    {selectedEmails.size > 0 && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => {
                          selectedEmails.forEach(id => archiveEmail(id));
                          setSelectedEmails(new Set());
                        }}>
                          <Archive className="w-4 h-4 mr-1" />
                          Archive
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          selectedEmails.forEach(id => deleteEmail(id));
                          setSelectedEmails(new Set());
                        }}>
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => {
                      setBulkSelectMode(false);
                      setSelectedEmails(new Set());
                    }}>
                      Cancel
                    </Button>
                  </div>
                )}
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filteredEmails.map((email) => {
                    const account = emailAccounts.find(acc => acc.id === email.email_account_id);
                    return (
                      <motion.div
                        key={email.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onMouseEnter={() => setHoveredEmailId(email.id)}
                        onMouseLeave={() => setHoveredEmailId(null)}
                        onClick={() => !bulkSelectMode && handleEmailClick(email)}
                        className={`p-4 cursor-pointer relative transition-all ${
                          !email.is_read ? 'glass border-l-4 border-purple-400' : 'hover:bg-white/[0.03]'
                        } ${selectedEmailId === email.id ? 'bg-white/[0.08]' : ''}`}
                      >
                        {/* Account color indicator */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${account ? getAccountColor(account) : 'bg-gray-400'}`} />
                        
                        <div className="flex items-start space-x-3 pl-2">
                          {/* Checkbox for bulk selection */}
                          <input
                            type="checkbox"
                            checked={selectedEmails.has(email.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              const newSelected = new Set(selectedEmails);
                              if (e.target.checked) {
                                newSelected.add(email.id);
                              } else {
                                newSelected.delete(email.id);
                              }
                              setSelectedEmails(newSelected);
                              if (newSelected.size > 0 && !bulkSelectMode) {
                                setBulkSelectMode(true);
                              }
                            }}
                            className="mt-1.5 rounded"
                            onClick={(e) => e.stopPropagation()}
                          />
                          
                          {/* Avatar */}
                          <div className="mt-0.5">
                            <EmailAvatar 
                              email={email.from_address} 
                              name={email.from_name}
                              size="sm"
                            />
                          </div>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStar(email.id, email.is_starred);
                            }}
                            className="mt-1"
                          >
                            <Star className={`w-4 h-4 ${
                              email.is_starred ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-400'
                            }`} />
                          </button>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center space-x-2">
                                <span className={`text-sm truncate ${!email.is_read ? 'font-semibold' : ''}`}>
                                  {email.from_name || email.from_address}
                                </span>
                                {/* Account label */}
                                {account && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full text-white ${getAccountColor(account)}`}>
                                    {account.display_name || account.email_address.split('@')[0]}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-neutral-500">
                                {formatLocalDate(email.date)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`text-sm truncate flex-1 ${!email.is_read ? 'font-medium' : ''}`}>
                                {email.subject}
                              </div>
                              {email.has_attachments && (
                                <Paperclip className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
                              )}
                            </div>
                            {/* Display labels */}
                            {email.labels && email.labels.length > 0 && (
                              <div className="flex items-center gap-1 mb-1">
                                {email.labels.map((label: string, index: number) => (
                                  <span 
                                    key={index}
                                    className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="text-xs text-neutral-500 truncate">
                              {email.snippet}
                            </div>
                          </div>
                        </div>
                        
                        {/* Hover actions */}
                        {hoveredEmailId === email.id && !bulkSelectMode && (
                          <EmailHoverActions
                            emailId={email.id}
                            isRead={email.is_read}
                            isSpam={email.is_spam}
                            onArchive={currentView !== 'trash' ? () => archiveEmail(email.id) : undefined}
                            onRestore={currentView === 'trash' ? () => restoreEmail(email.id) : undefined}
                            onDelete={() => deleteEmail(email.id)}
                            onToggleRead={() => toggleRead(email.id, email.is_read)}
                            onSnooze={() => openSnoozePopup(email.id)}
                            onSelect={() => setBulkSelectMode(true)}
                            onLabel={() => labelEmail(email.id)}
                            onSpam={currentView !== 'spam' && currentView !== 'trash' ? () => markAsSpam(email.id) : undefined}
                            onUnspam={currentView === 'spam' ? () => unmarkAsSpam(email.id) : undefined}
                          />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
                {loadingMore && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Email Viewer Panel - Takes remaining space on desktop, full screen on mobile */}
          {selectedEmail && (
            <div className="fixed md:relative inset-0 md:inset-auto flex-1 w-full glass z-50 md:z-auto overflow-y-auto p-2 md:p-3">
              <div className="w-full">
                {/* Mobile back button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedEmailLocal(null)}
                  className="md:hidden mb-2"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1 mr-4">
                      <h2 className="text-xl font-bold truncate">{selectedEmail.subject}</h2>
                      {/* Display labels */}
                      {selectedEmail.labels && selectedEmail.labels.length > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          {selectedEmail.labels.map((label: string, index: number) => (
                            <span 
                              key={index}
                              className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedEmailLocal(null)}
                      className="hidden md:block"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center space-x-2 flex-wrap">
                    {currentView === 'trash' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          restoreEmail(selectedEmail.id);
                          setSelectedEmailLocal(null);
                        }}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Restore
                      </Button>
                    ) : currentView === 'archive' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          unarchiveEmail(selectedEmail.id);
                          setSelectedEmailLocal(null);
                        }}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Unarchive
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          archiveEmail(selectedEmail.id);
                          setSelectedEmailLocal(null);
                        }}
                      >
                        <Archive className="w-4 h-4 mr-2" />
                        Archive
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        deleteEmail(selectedEmail.id);
                        setSelectedEmailLocal(null);
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                    {currentView !== 'spam' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          markAsSpam(selectedEmail.id);
                          setSelectedEmailLocal(null);
                        }}
                      >
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Mark as Spam
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRead(selectedEmail.id, selectedEmail.is_read)}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Mark as {selectedEmail.is_read ? 'unread' : 'read'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openSnoozePopup(selectedEmail.id)}
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Snooze
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleStar(selectedEmail.id, selectedEmail.is_starred)}
                    >
                      <Star className={`w-4 h-4 mr-2 ${
                        selectedEmail.is_starred ? 'fill-yellow-400 text-yellow-400' : ''
                      }`} />
                      {selectedEmail.is_starred ? 'Unstar' : 'Star'}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <EmailAvatar 
                      email={selectedEmail.from_address} 
                      name={selectedEmail.from_name}
                      size="md"
                    />
                    <div>
                      <div className="font-medium">{selectedEmail.from_name || selectedEmail.from_address}</div>
                      <div className="text-sm text-neutral-500">
                        to {(() => {
                          try {
                            const addresses = typeof selectedEmail.to_addresses === 'string' 
                              ? JSON.parse(selectedEmail.to_addresses || '[]')
                              : selectedEmail.to_addresses || [];
                            return addresses.map((a: any) => 
                              typeof a === 'string' ? a : a.address || a.name || a
                            ).join(', ');
                          } catch {
                            return selectedEmail.to_addresses || '';
                          }
                        })()}
                      </div>
                      <div className="text-sm text-neutral-500">
                        {format(new Date(selectedEmail.date), 'MMM d, yyyy h:mm a')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setComposeReplyTo(selectedEmail);
                        setComposeMode('reply');
                        setComposeOpen(true);
                      }}
                    >
                      <Reply className="w-4 h-4 mr-2" />
                      Reply
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setComposeReplyTo(selectedEmail);
                        setComposeMode('replyAll');
                        setComposeOpen(true);
                      }}
                    >
                      <ReplyAll className="w-4 h-4 mr-2" />
                      Reply All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setComposeReplyTo(selectedEmail);
                        setComposeMode('forward');
                        setComposeOpen(true);
                      }}
                    >
                      <Forward className="w-4 h-4 mr-2" />
                      Forward
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const printContent = document.getElementById('email-content');
                        if (printContent) {
                          const printWindow = window.open('', '', 'width=800,height=600');
                          if (printWindow) {
                            printWindow.document.write('<html><head><title>Print Email</title></head><body>');
                            printWindow.document.write(printContent.innerHTML);
                            printWindow.document.write('</body></html>');
                            printWindow.document.close();
                            printWindow.print();
                          }
                        }
                      }}
                    >
                      <Printer className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Attachments Section */}
                {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                  <div className="p-4 border-b border-neutral-700">
                    <div className="flex items-center gap-2 mb-3">
                      <Paperclip className="w-4 h-4 text-neutral-400" />
                      <span className="text-sm font-medium text-neutral-300">
                        {selectedEmail.attachments.length} Attachment{selectedEmail.attachments.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {selectedEmail.attachments.map((attachment: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-neutral-700 flex items-center justify-center">
                              <FileText className="w-5 h-5 text-neutral-400" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm text-neutral-200 truncate max-w-[300px]">
                                {attachment.filename || 'Unnamed attachment'}
                              </span>
                              <span className="text-xs text-neutral-500">
                                {attachment.size ? `${(attachment.size / 1024).toFixed(1)} KB` : 'Unknown size'}
                                {attachment.content_type && ` • ${attachment.content_type.split('/')[1]?.toUpperCase() || attachment.content_type}`}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                // Preview functionality (if needed later)
                                console.log('Preview attachment:', attachment);
                              }}
                              className="p-2 rounded-lg hover:bg-neutral-700 transition-colors"
                              title="Preview"
                            >
                              <Eye className="w-4 h-4 text-neutral-400" />
                            </button>
                            <button
                              onClick={() => {
                                // Download attachment
                                window.open(`${process.env.NEXT_PUBLIC_API_URL}/mail/attachments/${attachment.id}/download`, '_blank');
                              }}
                              className="p-2 rounded-lg hover:bg-neutral-700 transition-colors"
                              title="Download"
                            >
                              <Download className="w-4 h-4 text-neutral-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div id="email-content">
                  {loadingEmailBody ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-neutral-400 mb-4" />
                      <p className="text-neutral-500">Loading email content...</p>
                    </div>
                  ) : (
                    <div className="email-content-wrapper text-neutral-200">
                      {selectedEmail.html_body ? (
                        <div 
                          className="email-html-content"
                          dangerouslySetInnerHTML={{ __html: selectedEmail.html_body }} 
                        />
                      ) : selectedEmail.text_body ? (
                        <pre className="whitespace-pre-wrap font-sans text-neutral-200">{selectedEmail.text_body}</pre>
                      ) : (
                        <div className="text-neutral-500 italic">No content available</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Popups */}
      <SnoozePopup
        isOpen={snoozePopupOpen}
        onClose={() => setSnoozePopupOpen(false)}
        onSnooze={(date) => {
          if (snoozeEmailId) {
            snoozeEmail(snoozeEmailId, date);
          }
        }}
        emailSubject={safeEmails.find(e => e.id === snoozeEmailId)?.subject}
      />

      <TagPopup
        isOpen={tagPopupOpen}
        onClose={() => setTagPopupOpen(false)}
        onApplyTags={(tags) => {
          if (tagEmailId) {
            applyTagsToEmail(tagEmailId, tags);
          }
        }}
        currentTags={safeEmails.find(e => e.id === tagEmailId)?.labels || []}
      />
    </div>
  );
}