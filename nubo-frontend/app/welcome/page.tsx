'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, ChevronDown, Loader2, Shield, Zap, Lock, 
  Globe, Check, X, Info, ExternalLink 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import api from '@/lib/api';

interface Provider {
  id: string;
  name: string;
  logo?: string;
  color?: string;
  supportedFeatures: {
    oauth: boolean;
    imap: boolean;
    smtp: boolean;
    refresh: boolean;
  };
  setupInstructions?: string;
}

export default function WelcomePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [providers, setProviders] = useState<{ popular: Provider[]; other: Provider[] }>({
    popular: [],
    other: [],
  });
  const [loading, setLoading] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [appPasswordDialog, setAppPasswordDialog] = useState<{
    open: boolean;
    provider: Provider | null;
  }>({ open: false, provider: null });
  const [appPasswordForm, setAppPasswordForm] = useState({
    email: '',
    password: '',
    displayName: '',
  });

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const response = await api.get('/oauth/providers');
      setProviders(response.data);
    } catch (error) {
      console.error('Failed to load providers:', error);
      showToast('Failed to load email providers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const connectProvider = async (provider: Provider) => {
    if (!provider.supportedFeatures.oauth) {
      // Show app password dialog
      setAppPasswordDialog({ open: true, provider });
      return;
    }
    
    setConnectingProvider(provider.id);
    try {
      const response = await api.post(`/oauth/auth/init/${provider.id}`, {
        redirectUrl: `${window.location.origin}/settings/accounts`,
      });
      
      // Redirect to OAuth provider
      window.location.href = response.data.authUrl;
    } catch (error: any) {
      console.error('Failed to initiate OAuth:', error);
      if (error.response?.data?.setupInstructions) {
        showToast(error.response.data.setupInstructions, 'info');
      } else {
        showToast('Failed to connect to provider', 'error');
      }
      setConnectingProvider(null);
    }
  };

  const handleAppPasswordSubmit = async () => {
    if (!appPasswordDialog.provider) return;
    
    setConnectingProvider(appPasswordDialog.provider.id);
    try {
      await api.post('/oauth/accounts/app-password', {
        provider: appPasswordDialog.provider.id,
        email: appPasswordForm.email,
        password: appPasswordForm.password,
        displayName: appPasswordForm.displayName || appPasswordForm.email,
      });
      
      showToast('Account added successfully!', 'success');
      router.push('/inbox');
    } catch (error) {
      console.error('Failed to add app password account:', error);
      showToast('Failed to add account. Please check your credentials.', 'error');
    } finally {
      setConnectingProvider(null);
      setAppPasswordDialog({ open: false, provider: null });
      setAppPasswordForm({ email: '', password: '', displayName: '' });
    }
  };

  const ProviderButton = ({ provider }: { provider: Provider }) => (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => connectProvider(provider)}
      disabled={connectingProvider === provider.id}
      className={`relative p-6 rounded-2xl border-2 transition-all duration-200 ${
        connectingProvider === provider.id
          ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-lg bg-white'
      }`}
      style={{
        borderColor: connectingProvider === provider.id ? undefined : provider.color + '30',
      }}
    >
      {connectingProvider === provider.id && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-2xl flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: provider.color }} />
        </div>
      )}
      
      <div className="flex flex-col items-center space-y-3">
        {provider.logo ? (
          <img 
            src={provider.logo} 
            alt={provider.name} 
            className="w-12 h-12 object-contain"
          />
        ) : (
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: provider.color || '#6B7280' }}
          >
            {provider.name.charAt(0).toUpperCase()}
          </div>
        )}
        
        <div>
          <h3 className="font-semibold text-gray-900">{provider.name}</h3>
          {!provider.supportedFeatures.oauth && (
            <p className="text-xs text-gray-500 mt-1">App Password</p>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {provider.supportedFeatures.oauth && (
            <span className="text-xs text-green-600 flex items-center">
              <Shield className="w-3 h-3 mr-1" />
              OAuth
            </span>
          )}
          {provider.supportedFeatures.refresh && (
            <span className="text-xs text-blue-600 flex items-center">
              <Zap className="w-3 h-3 mr-1" />
              Auto-refresh
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center">
              <Mail className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Connect Your Email Accounts
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Securely connect your email accounts with OAuth 2.0 or app passwords. 
            Your credentials are encrypted and never shared.
          </p>
        </motion.div>

        {/* Features */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 text-center">
            <Shield className="w-10 h-10 text-green-600 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Secure Authentication</h3>
            <p className="text-sm text-gray-600">
              OAuth 2.0 with PKCE for maximum security
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 text-center">
            <Zap className="w-10 h-10 text-blue-600 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Auto Token Refresh</h3>
            <p className="text-sm text-gray-600">
              Tokens refresh automatically when needed
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 text-center">
            <Lock className="w-10 h-10 text-purple-600 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Privacy First</h3>
            <p className="text-sm text-gray-600">
              Your data stays yours, always encrypted
            </p>
          </div>
        </motion.div>

        {/* Popular Providers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Popular Providers</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {providers.popular.map((provider) => (
              <ProviderButton key={provider.id} provider={provider} />
            ))}
          </div>
        </motion.div>

        {/* Other Providers */}
        {providers.other.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="lg" className="min-w-[200px]">
                  <Globe className="w-5 h-5 mr-2" />
                  More Providers
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64">
                {providers.other.map((provider) => (
                  <DropdownMenuItem
                    key={provider.id}
                    onClick={() => connectProvider(provider)}
                    disabled={connectingProvider === provider.id}
                    className="py-3"
                  >
                    <div className="flex items-center space-x-3 w-full">
                      {provider.logo ? (
                        <img 
                          src={provider.logo} 
                          alt={provider.name} 
                          className="w-6 h-6 object-contain"
                        />
                      ) : (
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: provider.color || '#6B7280' }}
                        >
                          {provider.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="flex-1">{provider.name}</span>
                      {!provider.supportedFeatures.oauth && (
                        <span className="text-xs text-gray-500">App Password</span>
                      )}
                      {connectingProvider === provider.id && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>
        )}

        {/* Skip for now */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-12"
        >
          <Button
            variant="ghost"
            onClick={() => router.push('/inbox')}
            className="text-gray-600 hover:text-gray-900"
          >
            Skip for now →
          </Button>
        </motion.div>
      </div>

      {/* App Password Dialog */}
      <Dialog 
        open={appPasswordDialog.open} 
        onOpenChange={(open) => !open && setAppPasswordDialog({ open: false, provider: null })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Connect {appPasswordDialog.provider?.name}
            </DialogTitle>
            <DialogDescription>
              {appPasswordDialog.provider?.setupInstructions || 
                'This provider requires an app-specific password for secure access.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={appPasswordForm.email}
                onChange={(e) => setAppPasswordForm({ ...appPasswordForm, email: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">App Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter app-specific password"
                value={appPasswordForm.password}
                onChange={(e) => setAppPasswordForm({ ...appPasswordForm, password: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name (Optional)</Label>
              <Input
                id="displayName"
                placeholder="My Work Email"
                value={appPasswordForm.displayName}
                onChange={(e) => setAppPasswordForm({ ...appPasswordForm, displayName: e.target.value })}
              />
            </div>
            
            {appPasswordDialog.provider?.setupInstructions && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <Info className="w-4 h-4 inline mr-2" />
                {appPasswordDialog.provider.setupInstructions}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAppPasswordDialog({ open: false, provider: null })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAppPasswordSubmit}
              disabled={!appPasswordForm.email || !appPasswordForm.password || !!connectingProvider}
            >
              {connectingProvider ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect Account'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}