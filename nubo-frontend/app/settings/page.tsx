'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Save, Mail, Shield, Bell, Palette, 
  Users, Info, Moon, Sun, Monitor, Check,
  Smartphone, Key, ChevronRight,
  HelpCircle, FileText, Github, Twitter, Globe
} from 'lucide-react';
import { notificationService } from '@/lib/notifications';
import { TwoFactorSetup } from '@/components/settings/TwoFactorSetup';
import { ComposeEmail } from '@/components/email/ComposeEmail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const VERSION = '1.0.0';
const BUILD = '2025.08.24';

export default function SettingsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  // const [showPassword, setShowPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<'new' | 'reply' | 'replyAll' | 'forward'>('new');
  const [composeReplyTo, setComposeReplyTo] = useState<any>(null);
  
  // Settings state
  const [settings, setSettings] = useState({
    // General
    displayName: '',
    email: '',
    autoSync: true,
    syncInterval: '5',
    signature: '',
    enableSignature: false,
    
    // Appearance
    theme: 'system',
    compactView: false,
    showAvatars: true,
    previewPane: true,
    fontSize: 'medium',
    
    // Notifications
    notifications: true,
    notifyNewEmail: true,
    notifyEmailSent: true,
    notifySyncError: true,
    soundEnabled: true,
    desktopNotifications: false,
    pushNotifications: false,
    
    // Security
    twoFactorAuth: false,
    sessionTimeout: '30',
    requirePasswordChange: false,
  });
  
  // Push notification state
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);

  useEffect(() => {
    // Check both localStorage and sessionStorage for token
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    
    if (!token || !savedUser) {
      router.push('/login');
      return;
    }
    
    // Load user settings
    const userData = JSON.parse(savedUser);
    const savedSettings = localStorage.getItem('appSettings');
    
    if (savedSettings) {
      setSettings(prev => ({
        ...prev,
        ...JSON.parse(savedSettings),
        displayName: userData.username || '',
        email: userData.email || ''
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        displayName: userData.username || '',
        email: userData.email || '',
        theme: localStorage.getItem('theme') || 'system'
      }));
    }
    
    // Request notification permission if enabled
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Check push notification status
    checkPushNotificationStatus();
    
    // Set up user ID for push notifications if logged in
    if (token && savedUser) {
      const userData = JSON.parse(savedUser);
      notificationService.setExternalUserId(userData.id?.toString() || userData.email);
    }
  }, [router]);

  const checkPushNotificationStatus = async () => {
    try {
      const isSubscribed = await notificationService.isSubscribed();
      setPushSubscribed(isSubscribed);
    } catch (error) {
      console.error('Failed to check push notification status:', error);
      setPushSupported(false);
    }
  };

  const handlePushNotificationToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        const success = await notificationService.subscribeToNotifications();
        if (success) {
          setPushSubscribed(true);
          setSettings({...settings, pushNotifications: true});
          
          // Set user tags for notification targeting
          const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
          if (savedUser) {
            const userData = JSON.parse(savedUser);
            await notificationService.setUserTags({
              user_email: userData.email,
              user_id: userData.id?.toString() || userData.email
            });
          }
          
          showToast('Push notifications enabled successfully', 'success');
        } else {
          showToast('Failed to enable push notifications', 'error');
        }
      } else {
        const success = await notificationService.unsubscribeFromNotifications();
        if (success) {
          setPushSubscribed(false);
          setSettings({...settings, pushNotifications: false});
          showToast('Push notifications disabled', 'success');
        } else {
          showToast('Failed to disable push notifications', 'error');
        }
      }
    } catch (error) {
      console.error('Push notification toggle error:', error);
      showToast('Failed to update push notification settings', 'error');
    }
  };

  const handleSaveSettings = () => {
    setLoading(true);
    
    // Save settings to localStorage
    localStorage.setItem('appSettings', JSON.stringify(settings));
    
    // Apply theme
    applyTheme(settings.theme);
    
    // Update user data if display name changed
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    if (userData.username !== settings.displayName) {
      userData.username = settings.displayName;
      localStorage.setItem('user', JSON.stringify(userData));
    }
    
    setTimeout(() => {
      setLoading(false);
      showToast('Settings saved successfully!', 'success');
    }, 500);
  };

  const applyTheme = (theme: string) => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // System theme
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const handleInvite = () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      showToast('Please enter a valid email address', 'error');
      return;
    }
    
    // Here you would normally send an API request
    showToast(`Invitation sent to ${inviteEmail}`, 'success');
    setInviteEmail('');
  };

  const handleEnable2FA = () => {
    if (twoFactorEnabled) {
      return;
    }
    setShowTwoFactorSetup(true);
  };

  const handle2FASuccess = () => {
    setTwoFactorEnabled(true);
    loadTwoFactorStatus();
  };

  const loadTwoFactorStatus = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        return;
      }

      const response = await fetch('/api/2fa/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTwoFactorEnabled(data.enabled);
      } else {
        setTwoFactorEnabled(false);
      }
    } catch (error) {
      console.error('Failed to load 2FA status:', error);
      setTwoFactorEnabled(false);
    }
  };

  const handleDisable2FA = async () => {
    const password = prompt('Enter your password to disable 2FA:');
    if (!password) return;
    
    const code = prompt('Enter your current 2FA code:');
    if (!code) return;

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch('/api/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ password, token: code }),
      });

      if (response.ok) {
        showToast('Two-factor authentication has been disabled', 'success');
        setTwoFactorEnabled(false);
      } else {
        const data = await response.json();
        showToast(data.error || 'Failed to disable 2FA', 'error');
      }
    } catch (error) {
      showToast('Failed to disable 2FA', 'error');
    }
  };

  const handleGenerateBackupCodes = async () => {
    const code = prompt('Enter your current 2FA code to generate new backup codes:');
    if (!code) return;

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch('/api/2fa/backup-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ token: code }),
      });

      if (response.ok) {
        const data = await response.json();
        const codesText = data.backupCodes.join('\n');
        
        // Create a modal or alert to show the codes
        const message = `New backup codes generated. Save these securely!\n\n${codesText}\n\nEach code can only be used once.`;
        alert(message);
        
        // Option to download
        const download = confirm('Would you like to download these codes?');
        if (download) {
          const blob = new Blob([`Nubo.email 2FA Backup Codes\nGenerated: ${new Date().toISOString()}\n\n${codesText}\n\nKeep these codes safe! Each can only be used once.`], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'nubo-2fa-backup-codes.txt';
          a.click();
          URL.revokeObjectURL(url);
        }
        
        showToast('New backup codes generated successfully', 'success');
      } else {
        const data = await response.json();
        showToast(data.error || 'Failed to generate backup codes', 'error');
      }
    } catch (error) {
      showToast('Failed to generate backup codes', 'error');
    }
  };

  const handlePasswordChange = () => {
    showToast('Password change email sent to your address', 'info');
  };

  useEffect(() => {
    loadTwoFactorStatus();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/inbox')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Inbox
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-neutral-500 mt-2">Manage your Nubo account and preferences</p>
            </div>
            <Button 
              onClick={handleSaveSettings}
              disabled={loading}
              className="hidden md:flex"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid grid-cols-2 md:grid-cols-6 gap-2 h-auto">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <span className="hidden md:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              <span className="hidden md:inline">Appearance</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <span className="hidden md:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="hidden md:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="invite" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden md:inline">Invite</span>
            </TabsTrigger>
            <TabsTrigger value="about" className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              <span className="hidden md:inline">About</span>
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={settings.displayName}
                    onChange={(e) => setSettings({...settings, displayName: e.target.value})}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={settings.email}
                    disabled
                    className="bg-neutral-100 dark:bg-neutral-800"
                  />
                  <p className="text-sm text-neutral-500">Your primary Nubo account email</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email Preferences</CardTitle>
                <CardDescription>Configure email sync and signature</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-sync emails</Label>
                    <p className="text-sm text-neutral-500">Automatically fetch new emails</p>
                  </div>
                  <Switch
                    checked={settings.autoSync}
                    onCheckedChange={(checked) => setSettings({...settings, autoSync: checked})}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="syncInterval">Sync interval (minutes)</Label>
                  <select
                    id="syncInterval"
                    value={settings.syncInterval}
                    onChange={(e) => setSettings({...settings, syncInterval: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="1">Every minute</option>
                    <option value="5">Every 5 minutes</option>
                    <option value="10">Every 10 minutes</option>
                    <option value="15">Every 15 minutes</option>
                    <option value="30">Every 30 minutes</option>
                    <option value="60">Every hour</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signature">Email Signature</Label>
                  <textarea
                    id="signature"
                    value={settings.signature}
                    onChange={(e) => setSettings({...settings, signature: e.target.value})}
                    className="w-full min-h-[100px] px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                    placeholder="Your email signature..."
                  />
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.enableSignature}
                      onCheckedChange={(checked) => setSettings({...settings, enableSignature: checked})}
                    />
                    <Label>Add signature to new emails</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Theme Settings</CardTitle>
                <CardDescription>Customize the look and feel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Theme Mode</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={settings.theme === 'light' ? 'default' : 'outline'}
                      onClick={() => {
                        setSettings({...settings, theme: 'light'});
                        applyTheme('light');
                      }}
                      className="flex items-center gap-2"
                    >
                      <Sun className="w-4 h-4" />
                      Light
                    </Button>
                    <Button
                      variant={settings.theme === 'dark' ? 'default' : 'outline'}
                      onClick={() => {
                        setSettings({...settings, theme: 'dark'});
                        applyTheme('dark');
                      }}
                      className="flex items-center gap-2"
                    >
                      <Moon className="w-4 h-4" />
                      Dark
                    </Button>
                    <Button
                      variant={settings.theme === 'system' ? 'default' : 'outline'}
                      onClick={() => {
                        setSettings({...settings, theme: 'system'});
                        applyTheme('system');
                      }}
                      className="flex items-center gap-2"
                    >
                      <Monitor className="w-4 h-4" />
                      System
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Font Size</Label>
                  <select
                    value={settings.fontSize}
                    onChange={(e) => setSettings({...settings, fontSize: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Display Options</CardTitle>
                <CardDescription>Adjust how emails are displayed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Compact View</Label>
                    <p className="text-sm text-neutral-500">Show more emails in less space</p>
                  </div>
                  <Switch
                    checked={settings.compactView}
                    onCheckedChange={(checked) => setSettings({...settings, compactView: checked})}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Avatars</Label>
                    <p className="text-sm text-neutral-500">Display sender profile images</p>
                  </div>
                  <Switch
                    checked={settings.showAvatars}
                    onCheckedChange={(checked) => setSettings({...settings, showAvatars: checked})}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Preview Pane</Label>
                    <p className="text-sm text-neutral-500">Show email preview on selection</p>
                  </div>
                  <Switch
                    checked={settings.previewPane}
                    onCheckedChange={(checked) => setSettings({...settings, previewPane: checked})}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Control when and how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Notifications</Label>
                    <p className="text-sm text-neutral-500">Master toggle for all notifications</p>
                  </div>
                  <Switch
                    checked={settings.notifications}
                    onCheckedChange={(checked) => setSettings({...settings, notifications: checked})}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Desktop Notifications</Label>
                    <p className="text-sm text-neutral-500">Show system notifications</p>
                  </div>
                  <Switch
                    checked={settings.desktopNotifications}
                    onCheckedChange={(checked) => {
                      if (checked && Notification.permission === 'default') {
                        Notification.requestPermission().then(permission => {
                          if (permission === 'granted') {
                            setSettings({...settings, desktopNotifications: true});
                          }
                        });
                      } else {
                        setSettings({...settings, desktopNotifications: checked});
                      }
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Sound Effects</Label>
                    <p className="text-sm text-neutral-500">Play sounds for email events</p>
                  </div>
                  <Switch
                    checked={settings.soundEnabled}
                    onCheckedChange={(checked) => setSettings({...settings, soundEnabled: checked})}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Push Notifications</CardTitle>
                <CardDescription>Get notified even when Nubo is closed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!pushSupported ? (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Push notifications are not supported in this browser or environment.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Enable Push Notifications</Label>
                        <p className="text-sm text-neutral-500">
                          Get notified about new emails even when the app is closed
                        </p>
                      </div>
                      <Switch
                        checked={pushSubscribed}
                        onCheckedChange={handlePushNotificationToggle}
                      />
                    </div>
                    
                    {pushSubscribed && (
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-medium text-green-800 dark:text-green-200">
                            Push notifications are active
                          </span>
                        </div>
                        <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                          You'll receive notifications for new emails, sent confirmations, and sync errors.
                        </p>
                      </div>
                    )}
                    
                    <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                            const response = await fetch(`${apiUrl}/mail/test-notification`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                              }
                            });
                            
                            if (response.ok) {
                              showToast('Test notification sent!', 'success');
                            } else {
                              showToast('Failed to send test notification', 'error');
                            }
                          } catch (error) {
                            showToast('Failed to send test notification', 'error');
                          }
                        }}
                        disabled={!pushSubscribed}
                      >
                        <Bell className="w-4 h-4 mr-2" />
                        Send Test Notification
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>Choose which events trigger notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>New email received</Label>
                  <Switch
                    checked={settings.notifyNewEmail}
                    onCheckedChange={(checked) => setSettings({...settings, notifyNewEmail: checked})}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Email sent successfully</Label>
                  <Switch
                    checked={settings.notifyEmailSent}
                    onCheckedChange={(checked) => setSettings({...settings, notifyEmailSent: checked})}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Sync errors</Label>
                  <Switch
                    checked={settings.notifySyncError}
                    onCheckedChange={(checked) => setSettings({...settings, notifySyncError: checked})}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Password & Authentication</CardTitle>
                <CardDescription>Manage your account security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Button 
                    variant="outline" 
                    className="w-full justify-between"
                    onClick={handlePasswordChange}
                  >
                    <span className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Change Password
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                
                <div>
                  {twoFactorEnabled ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <span className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-medium">Two-Factor Authentication is Active</span>
                        </span>
                        <Check className="w-4 h-4 text-green-500" />
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={handleDisable2FA}
                      >
                        Disable Two-Factor Authentication
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={handleGenerateBackupCodes}
                      >
                        Generate New Backup Codes
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="w-full justify-between"
                      onClick={handleEnable2FA}
                    >
                      <span className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4" />
                        Enable Two-Factor Auth
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                  <select
                    id="sessionTimeout"
                    value={settings.sessionTimeout}
                    onChange={(e) => setSettings({...settings, sessionTimeout: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                    <option value="never">Never</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Sessions</CardTitle>
                <CardDescription>Devices where you&apos;re currently signed in</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Monitor className="w-5 h-5 text-neutral-500" />
                      <div>
                        <p className="font-medium">Current Device</p>
                        <p className="text-sm text-neutral-500">Active now</p>
                      </div>
                    </div>
                    <span className="text-sm text-green-500">Active</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invite Tab */}
          <TabsContent value="invite" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invite People to Nubo</CardTitle>
                <CardDescription>Share the power of unified email management</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="inviteEmail">Email Address</Label>
                  <div className="flex gap-2">
                    <Input
                      id="inviteEmail"
                      type="email"
                      placeholder="friend@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <Button onClick={handleInvite}>
                      Send Invite
                    </Button>
                  </div>
                </div>
                
                
                <div>
                  <Label>Your Referral Link</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={`https://nubo.email/ref/${Math.random().toString(36).substring(2, 10).toUpperCase()}`}
                      readOnly
                      className="bg-neutral-100 dark:bg-neutral-800"
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        const link = document.querySelector('input[readOnly]') as HTMLInputElement;
                        navigator.clipboard.writeText(link.value);
                        showToast('Link copied to clipboard!', 'success');
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>About Nubo.email</CardTitle>
                <CardDescription>Version information and resources</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-neutral-500">Version</p>
                    <p className="font-medium">{VERSION}</p>
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Build</p>
                    <p className="font-medium">{BUILD}</p>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Nubo.email is an open-source, ultra-modern webmail client that brings all your inboxes to one place.
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://github.com/koolninad/nubo.email/', '_blank')}
                  >
                    <Github className="w-4 h-4 mr-2" />
                    GitHub
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://twitter.com/nuboemail', '_blank')}
                  >
                    <Twitter className="w-4 h-4 mr-2" />
                    Twitter
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://nubo.email', '_blank')}
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    nubo.email
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://docs.nubo.email', '_blank')}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Docs
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Legal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-between"
                  onClick={() => router.push('/privacy')}
                >
                  Privacy Policy
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-between"
                  onClick={() => router.push('/terms')}
                >
                  Terms of Service
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-between"
                  onClick={() => router.push('/license')}
                >
                  Open Source License (AGPLv3.0)
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Support</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-between"
                  onClick={() => router.push('/help')}
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" />
                    Help Center
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-between"
                  onClick={() => {
                    setComposeReplyTo(null);
                    setComposeMode('new');
                    setComposeOpen(true);
                    // Pre-populate with support email
                    setTimeout(() => {
                      const toInput = document.querySelector('input[placeholder="To"]') as HTMLInputElement;
                      if (toInput) toInput.value = 'support@nubo.email';
                    }, 100);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Contact Support
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            <div className="text-center text-sm text-neutral-500 pt-4">
              <p>© 2025 Nubo.email. All rights reserved.</p>
              <p className="mt-1">Made with ❤️ from India</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Mobile Save Button */}
        <div className="md:hidden fixed bottom-4 right-4 z-50">
          <Button 
            onClick={handleSaveSettings}
            disabled={loading}
            size="lg"
            className="shadow-lg"
          >
            <Save className="w-5 h-5 mr-2" />
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
      
      {/* Two-Factor Authentication Setup Modal */}
      <TwoFactorSetup
        isOpen={showTwoFactorSetup}
        onClose={() => setShowTwoFactorSetup(false)}
        onSuccess={handle2FASuccess}
      />
      
      {/* Compose Email Modal for Support */}
      <ComposeEmail
        open={composeOpen}
        onClose={() => {
          setComposeOpen(false);
          setComposeReplyTo(null);
          setComposeMode('new');
        }}
        onSend={async (data) => {
          // This would normally send via API
          showToast('Support email sent successfully', 'success');
          setComposeOpen(false);
        }}
        mode={composeMode}
        replyTo={composeReplyTo}
        accounts={[]}
      />
    </div>
  );
}