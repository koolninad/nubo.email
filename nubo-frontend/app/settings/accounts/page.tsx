'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, Plus, Trash2, RefreshCw, CheckCircle, XCircle,
  AlertCircle, Clock, Shield, Loader2, ExternalLink, Settings,
  Key, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/toast';
import api from '@/lib/api';
import { format } from 'date-fns';

interface OAuthAccount {
  id: number;
  provider: string;
  email_address: string;
  display_name: string;
  auth_method: 'OAUTH' | 'PASSWORD';
  status: 'active' | 'expired' | 'invalid';
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
}

const providerConfig: Record<string, { name: string; color: string; logo?: string }> = {
  google: { name: 'Google', color: '#4285F4', logo: '/logos/google.svg' },
  yahoo: { name: 'Yahoo', color: '#6001D2', logo: '/logos/yahoo.svg' },
  microsoft: { name: 'Outlook', color: '#0078D4', logo: '/logos/outlook.svg' },
  proton: { name: 'Proton Mail', color: '#6D4AFF', logo: '/logos/proton.svg' },
  icloud: { name: 'iCloud Mail', color: '#007AFF', logo: '/logos/icloud.svg' },
  zoho: { name: 'Zoho Mail', color: '#DC4A38', logo: '/logos/zoho.svg' },
  fastmail: { name: 'Fastmail', color: '#69B7E5', logo: '/logos/fastmail.svg' },
  tutanota: { name: 'Tutanota', color: '#A01E22', logo: '/logos/tutanota.svg' },
  yandex: { name: 'Yandex Mail', color: '#FF0000', logo: '/logos/yandex.svg' },
};

function AccountsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<OAuthAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingAccount, setRefreshingAccount] = useState<number | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<number | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    open: boolean;
    account: OAuthAccount | null;
  }>({ open: false, account: null });

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    
    // Check for success/error params from OAuth callback
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const provider = searchParams.get('provider');
    
    if (success === 'true' && provider) {
      showToast(`Successfully connected ${provider} account!`, 'success');
      // Clear the URL params
      router.replace('/settings/accounts');
    } else if (error) {
      const errorMessages: Record<string, string> = {
        missing_parameters: 'Missing required parameters',
        invalid_state: 'Invalid authentication state',
        invalid_provider: 'Invalid email provider',
        oauth_failed: 'OAuth authentication failed',
      };
      showToast(errorMessages[error] || 'Authentication failed', 'error');
      // Clear the URL params
      router.replace('/settings/accounts');
    }
    
    loadAccounts();
  }, [searchParams]);

  const loadAccounts = async () => {
    try {
      const response = await api.get('/oauth/accounts');
      setAccounts(response.data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
      showToast('Failed to load email accounts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const refreshAccount = async (accountId: number) => {
    setRefreshingAccount(accountId);
    try {
      await api.post(`/oauth/accounts/${accountId}/refresh`);
      showToast('Token refreshed successfully', 'success');
      await loadAccounts();
    } catch (error: any) {
      console.error('Failed to refresh token:', error);
      showToast(error.response?.data?.error || 'Failed to refresh token', 'error');
    } finally {
      setRefreshingAccount(null);
    }
  };

  const deleteAccount = async () => {
    if (!deleteConfirmation.account) return;
    
    const accountId = deleteConfirmation.account.id;
    setDeletingAccount(accountId);
    
    try {
      await api.delete(`/oauth/accounts/${accountId}`);
      showToast('Account removed successfully', 'success');
      setAccounts(accounts.filter(a => a.id !== accountId));
    } catch (error) {
      console.error('Failed to delete account:', error);
      showToast('Failed to remove account', 'error');
    } finally {
      setDeletingAccount(null);
      setDeleteConfirmation({ open: false, account: null });
    }
  };

  const getStatusBadge = (account: OAuthAccount) => {
    if (account.status === 'active') {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    } else if (account.status === 'expired') {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <Clock className="w-3 h-3 mr-1" />
          Token Expired
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <XCircle className="w-3 h-3 mr-1" />
          Invalid
        </Badge>
      );
    }
  };

  const AccountCard = ({ account }: { account: OAuthAccount }) => {
    const config = providerConfig[account.provider] || { 
      name: account.provider, 
      color: '#6B7280' 
    };
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <div className="backdrop-blur-md bg-white/50 rounded-xl p-6 border border-white/60 shadow-xl hover:shadow-2xl transition-all hover:bg-white/60">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              {/* Provider Logo */}
              <div className="flex-shrink-0">
                {config.logo ? (
                  <img 
                    src={config.logo} 
                    alt={config.name} 
                    className="w-12 h-12 object-contain"
                  />
                ) : (
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: config.color }}
                  >
                    {config.name.charAt(0)}
                  </div>
                )}
              </div>
              
              {/* Account Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{config.name}</h3>
                  {getStatusBadge(account)}
                </div>
                
                <p className="text-sm text-gray-600 truncate">
                  {account.email_address}
                </p>
                
                {account.display_name && account.display_name !== account.email_address && (
                  <p className="text-xs text-gray-500 mt-1">
                    {account.display_name}
                  </p>
                )}
                
                <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                  <span className="flex items-center">
                    {account.auth_method === 'OAUTH' ? (
                      <>
                        <Shield className="w-3 h-3 mr-1" />
                        OAuth 2.0
                      </>
                    ) : (
                      <>
                        <Key className="w-3 h-3 mr-1" />
                        App Password
                      </>
                    )}
                  </span>
                  
                  {account.last_sync_at && (
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      Last sync: {format(new Date(account.last_sync_at), 'MMM d, h:mm a')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center space-x-2">
              {account.status === 'expired' && account.auth_method === 'OAUTH' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refreshAccount(account.id)}
                  disabled={refreshingAccount === account.id}
                >
                  {refreshingAccount === account.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              )}
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDeleteConfirmation({ open: true, account })}
                disabled={deletingAccount === account.id}
              >
                {deletingAccount === account.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 text-red-500" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header with navigation */}
        <div className="mb-8 backdrop-blur-md bg-white/30 rounded-2xl p-6 border border-white/50 shadow-xl">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Email Accounts
              </h1>
              <p className="text-gray-700">
                Manage your connected email accounts and authentication settings
              </p>
            </div>
            <Button 
              onClick={() => router.push('/inbox')}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
            >
              <Mail className="w-4 h-4 mr-2" />
              Go to Inbox
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="backdrop-blur-md bg-white/40 rounded-xl p-5 border border-white/50 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-500/20 backdrop-blur rounded-lg border border-blue-200/30">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-700 font-medium">Total Accounts</p>
                <p className="text-2xl font-bold text-gray-900">{accounts.length}</p>
              </div>
            </div>
          </div>
          
          <div className="backdrop-blur-md bg-white/40 rounded-xl p-5 border border-white/50 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-green-500/20 backdrop-blur rounded-lg border border-green-200/30">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-700 font-medium">Active</p>
                <p className="text-2xl font-bold text-gray-900">
                  {accounts.filter(a => a.status === 'active').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="backdrop-blur-md bg-white/40 rounded-xl p-5 border border-white/50 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-purple-500/20 backdrop-blur rounded-lg border border-purple-200/30">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-700 font-medium">OAuth Accounts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {accounts.filter(a => a.auth_method === 'OAUTH').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Accounts List */}
        {accounts.length === 0 ? (
          <div className="backdrop-blur-md bg-white/40 rounded-2xl p-12 border border-white/50 shadow-xl text-center">
            <div className="max-w-sm mx-auto">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/50">
                <Mail className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900">No accounts connected</h3>
              <p className="text-gray-700 mb-6">
                Connect your email accounts to start managing your emails in one place
              </p>
              <Button 
                onClick={() => router.push('/welcome')}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Email Account
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-8">
              <AnimatePresence>
                {accounts.map((account) => (
                  <AccountCard key={account.id} account={account} />
                ))}
              </AnimatePresence>
            </div>
            
            <div className="text-center">
              <Button 
                onClick={() => router.push('/welcome')}
                className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white shadow-lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Another Account
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={deleteConfirmation.open} 
        onOpenChange={(open) => !open && setDeleteConfirmation({ open: false, account: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Email Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deleteConfirmation.account?.email_address}? 
              This will disconnect the account and remove all associated tokens. 
              You can reconnect the account later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteAccount}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <AccountsPageContent />
    </Suspense>
  );
}