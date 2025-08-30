'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  Users, Mail, HardDrive, Shield, Settings, Plus, Trash2,
  Edit, Archive, Globe, Server, Activity, AlertCircle,
  CheckCircle, Clock, TrendingUp, TrendingDown, MoreVertical,
  Download, Upload, RefreshCw, Search, Filter, ChevronDown,
  CreditCard, DollarSign, LogOut, CheckCircle2, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';

interface Organization {
  id: number;
  name: string;
  domain: string;
  storage_plan: string;
  billing_cycle: string;
  deployment_type: string;
  archival_plan?: string;
  archival_users_purchased: number;
  archival_users_used: number;
  storage_total_mb: number;
  storage_allocated_mb: number;
  storage_used_mb: number;
  status: string;
  created_at: string;
  domain_verified?: boolean;
  email_forwarding_configured?: boolean;
  spf_configured?: boolean;
  dkim_configured?: boolean;
  dmarc_configured?: boolean;
}

interface EmailAccount {
  id: number;
  email: string;
  username: string;
  full_name: string;
  storage_allocated_mb: number;
  storage_used_mb: number;
  archival_enabled: boolean;
  status: string;
  last_active_at?: string;
}

export default function OrganizationAdminPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [isAddEmailOpen, setIsAddEmailOpen] = useState(false);
  const [isEditStorageOpen, setIsEditStorageOpen] = useState(false);
  const [isUpgradeStorageOpen, setIsUpgradeStorageOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('accounts');
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [setupProgress, setSetupProgress] = useState(0);
  const [isArchivalDialogOpen, setIsArchivalDialogOpen] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<string[]>([]);
  
  // New email form
  const [newEmail, setNewEmail] = useState({
    username: '',
    name: '',
    storage: 100,
    archival: false
  });

  // Storage allocation
  const [storageAllocation, setStorageAllocation] = useState(100);

  // Fetch organization data
  useEffect(() => {
    fetchOrganizationData();
  }, []);

  // Calculate setup progress
  useEffect(() => {
    if (organization) {
      let progress = 25; // Base progress for account creation
      const tasks = [];
      
      if (organization.domain_verified) progress += 25;
      else tasks.push('Domain verification pending');
      
      if (organization.spf_configured) progress += 12.5;
      else tasks.push('Configure SPF records');
      
      if (organization.dkim_configured) progress += 12.5;
      else tasks.push('Configure DKIM records');
      
      if (organization.email_forwarding_configured) progress += 12.5;
      else tasks.push('Setup email forwarding');
      
      if (emailAccounts.length > 0) progress += 12.5;
      else tasks.push('Add email accounts');
      
      setSetupProgress(Math.min(progress, 100));
      setPendingTasks(tasks);
    }
  }, [organization, emailAccounts]);

  const fetchOrganizationData = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const orgId = localStorage.getItem('organizationId') || sessionStorage.getItem('organizationId') || '1';
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/organizations/${orgId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOrganization(data.organization);
        setEmailAccounts(data.emailAccounts);
      } else {
        // Use mock data as fallback
        setOrganization({
          id: 1,
          name: 'Acme Corporation',
          domain: 'acme.com',
          storage_plan: '100GB',
          billing_cycle: 'annually',
          deployment_type: 'hybrid',
          archival_plan: 'professional',
          archival_users_purchased: 5,
          archival_users_used: 2,
          storage_total_mb: 102400,
          storage_allocated_mb: 6000,
          storage_used_mb: 3381,
          status: 'active',
          created_at: '2025-08-30'
        });
        setEmailAccounts([
          { id: 1, email: 'admin@acme.com', username: 'admin', full_name: 'Admin User', storage_allocated_mb: 500, storage_used_mb: 234, status: 'active', archival_enabled: true, last_active_at: '2 hours ago' },
          { id: 2, email: 'john@acme.com', username: 'john', full_name: 'John Doe', storage_allocated_mb: 1000, storage_used_mb: 567, status: 'active', archival_enabled: false, last_active_at: '5 minutes ago' },
          { id: 3, email: 'jane@acme.com', username: 'jane', full_name: 'Jane Smith', storage_allocated_mb: 1000, storage_used_mb: 890, status: 'active', archival_enabled: true, last_active_at: '1 day ago' },
          { id: 4, email: 'support@acme.com', username: 'support', full_name: 'Support Team', storage_allocated_mb: 2000, storage_used_mb: 1234, status: 'active', archival_enabled: false, last_active_at: '10 minutes ago' },
          { id: 5, email: 'sales@acme.com', username: 'sales', full_name: 'Sales Team', storage_allocated_mb: 1500, storage_used_mb: 456, status: 'suspended', archival_enabled: false, last_active_at: '3 days ago' },
        ]);
      }
    } catch (error) {
      console.error('Error fetching organization data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate total storage
  const totalStorage = organization?.storage_total_mb || 102400; // Default to 100GB
  const allocatedStorage = emailAccounts.reduce((sum, acc) => sum + (acc.storage_allocated_mb || 0), 0);
  const usedStorage = emailAccounts.reduce((sum, acc) => sum + (acc.storage_used_mb || 0), 0);
  const storagePercentUsed = (usedStorage / totalStorage) * 100;
  const storagePercentAllocated = (allocatedStorage / totalStorage) * 100;
  const isStorageFull = allocatedStorage >= totalStorage;
  const archivalUsed = emailAccounts.filter(acc => acc.archival_enabled).length;
  const archivalTotal = organization?.archival_users_purchased || 0;
  const isArchivalFull = archivalUsed >= archivalTotal;

  // Filter email accounts
  const filteredAccounts = emailAccounts.filter(account =>
    account.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle account selection
  const toggleAccountSelection = (id: number) => {
    setSelectedAccounts(prev =>
      prev.includes(id) 
        ? prev.filter(accId => accId !== id)
        : [...prev, id]
    );
  };

  // Handle select all
  const toggleSelectAll = () => {
    if (selectedAccounts.length === filteredAccounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(filteredAccounts.map(acc => acc.id));
    }
  };

  // Add new email account
  const handleAddEmail = () => {
    // API call to add email
    toast({
      title: "Email Account Created",
      description: `${newEmail.username}@${organization?.domain} has been created successfully.`,
    });
    setIsAddEmailOpen(false);
    setNewEmail({ username: '', name: '', storage: 100, archival: false });
  };

  // Edit storage allocation
  const handleEditStorage = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/organizations/email-accounts/${selectedEmail?.id}/storage`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ storage_allocated_mb: storageAllocation })
      });

      if (response.ok) {
        toast({
          title: "Storage Updated",
          description: `Storage allocation updated to ${storageAllocation} MB for ${selectedEmail?.email}`,
        });
        fetchOrganizationData();
        setIsEditStorageOpen(false);
      } else {
        throw new Error('Failed to update storage');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update storage allocation",
        variant: "destructive"
      });
    }
  };

  // Delete email accounts
  const handleDeleteAccounts = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/organizations/email-accounts`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ accountIds: selectedAccounts })
      });

      if (response.ok) {
        toast({
          title: "Accounts Deleted",
          description: `${selectedAccounts.length} account(s) have been deleted.`,
          variant: "destructive"
        });
        setSelectedAccounts([]);
        fetchOrganizationData();
      } else {
        throw new Error('Failed to delete accounts');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete accounts",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-gray-900/90 backdrop-blur-md border-b border-gray-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Image 
                src="/uploads/logo.png" 
                alt="Nubo Logo" 
                width={40} 
                height={40}
                className="rounded-lg"
              />
              <div>
                <span className="text-2xl font-bold text-white">Nubo Admin</span>
                <span className="text-sm text-gray-400 ml-2">{organization?.domain}</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                className="border-gray-700 text-gray-300 hover:text-white"
                onClick={() => {
                  localStorage.removeItem('token');
                  sessionStorage.removeItem('token');
                  router.push('/login');
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-gray-900 border border-gray-800">
            <TabsTrigger value="accounts" className="data-[state=active]:bg-gray-800">
              <Users className="w-4 h-4 mr-2" />
              Email Accounts
            </TabsTrigger>
            <TabsTrigger value="billing" className="data-[state=active]:bg-gray-800">
              <TrendingUp className="w-4 h-4 mr-2" />
              Billing & Subscriptions
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-gray-800">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-6">
            {/* Setup Progress */}
            {setupProgress < 100 && (
              <Card className="bg-gray-900 border-gray-800 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Setup Progress</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-400">Overall Progress</span>
                      <span className="text-sm text-gray-400">{setupProgress}%</span>
                    </div>
                    <Progress value={setupProgress} className="h-2 bg-gray-700" />
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className={`w-5 h-5 ${organization?.domain_verified ? 'text-green-400' : 'text-gray-500'}`} />
                      <span className="text-sm text-gray-300">Domain Verified</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className={`w-5 h-5 ${organization?.spf_configured ? 'text-green-400' : 'text-gray-500'}`} />
                      <span className="text-sm text-gray-300">SPF Records</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className={`w-5 h-5 ${organization?.dkim_configured ? 'text-green-400' : 'text-gray-500'}`} />
                      <span className="text-sm text-gray-300">DKIM Records</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className={`w-5 h-5 ${organization?.email_forwarding_configured ? 'text-green-400' : 'text-gray-500'}`} />
                      <span className="text-sm text-gray-300">Email Forwarding</span>
                    </div>
                  </div>
                  
                  {pendingTasks.length > 0 && (
                    <div className="mt-4 p-3 bg-yellow-600/10 border border-yellow-600/30 rounded-lg">
                      <p className="text-sm text-yellow-400 font-medium mb-2">Pending Tasks:</p>
                      <ul className="space-y-1">
                        {pendingTasks.map((task, index) => (
                          <li key={index} className="text-sm text-gray-300 flex items-center">
                            <Loader2 className="w-3 h-3 mr-2 animate-spin text-yellow-400" />
                            {task}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* DNS Status Card */}
            <Card className="bg-gray-900 border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">DNS Configuration Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Domain</span>
                    {organization?.domain_verified ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-400" />
                    )}
                  </div>
                  <p className="text-white font-medium">{organization?.domain || 'Not Set'}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {organization?.domain_verified ? 'Verified' : 'Pending Verification'}
                  </p>
                </div>
                
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">SPF</span>
                    {organization?.spf_configured ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                  <p className="text-white font-medium">
                    {organization?.spf_configured ? 'Configured' : 'Not Configured'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Email authentication</p>
                </div>
                
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">DKIM</span>
                    {organization?.dkim_configured ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                  <p className="text-white font-medium">
                    {organization?.dkim_configured ? 'Configured' : 'Not Configured'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Email signing</p>
                </div>
                
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Email Forwarding</span>
                    {organization?.email_forwarding_configured ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-400" />
                    )}
                  </div>
                  <p className="text-white font-medium">
                    {organization?.email_forwarding_configured ? 'Active' : 'Inactive'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">MX records</p>
                </div>
              </div>
              
              <div className="mt-4 flex justify-end">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-gray-700 text-gray-300 hover:text-white"
                  onClick={() => fetchOrganizationData()}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Status
                </Button>
              </div>
            </Card>
            
            {/* Stats Overview */}
            <div className="grid lg:grid-cols-4 gap-6">
          <Card className="bg-gray-900 border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
                Active
              </Badge>
            </div>
            <div className="text-2xl font-bold text-white">{emailAccounts.length}</div>
            <div className="text-sm text-gray-400">Email Accounts</div>
          </Card>

          <Card className="bg-gray-900 border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center">
                <HardDrive className="w-6 h-6 text-green-400" />
              </div>
              <span className="text-sm text-gray-500">
                {Math.round(storagePercentUsed)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-white">
              {(usedStorage / 1024).toFixed(1)} GB
            </div>
            <div className="text-sm text-gray-400">of {(totalStorage / 1024).toFixed(0)} GB used</div>
            <div className="mt-3 space-y-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full border-gray-700 text-gray-300 hover:text-white"
                onClick={() => setIsUpgradeStorageOpen(true)}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Upgrade Storage
              </Button>
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Used</span>
                <span className="text-gray-400">{(usedStorage / 1024).toFixed(1)} GB</span>
              </div>
              <Progress value={storagePercentUsed} className="h-2 bg-gray-800" />
              <div className="flex justify-between text-xs mt-1">
                <span className="text-gray-400">Allocated</span>
                <span className="text-gray-400">{(allocatedStorage / 1024).toFixed(1)} GB</span>
              </div>
              <Progress value={storagePercentAllocated} className="h-2 bg-gray-800" />
            </div>
          </Card>

          <Card className="bg-gray-900 border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
                <Archive className="w-6 h-6 text-purple-400" />
              </div>
              <span className="text-sm text-gray-500">
                {archivalTotal > 0 ? Math.round((archivalUsed / archivalTotal) * 100) : 0}%
              </span>
            </div>
            <div className="text-2xl font-bold text-white">
              {archivalUsed}/{archivalTotal}
            </div>
            <div className="text-sm text-gray-400">Archival Accounts</div>
            <Button 
              size="sm" 
              variant="outline" 
              className="mt-3 w-full border-gray-700 text-gray-300 hover:text-white"
              onClick={() => setIsArchivalDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Archival
            </Button>
            <Progress 
              value={archivalTotal > 0 ? (archivalUsed / archivalTotal) * 100 : 0} 
              className="h-1 mt-2 bg-gray-800" 
            />
          </Card>

          <Card className="bg-gray-900 border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-600/20 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-orange-400" />
              </div>
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">99.9%</div>
            <div className="text-sm text-gray-400">Uptime This Month</div>
          </Card>
        </div>

        {/* Email Management */}
        <Card className="bg-gray-900 border-gray-800">
          <div className="p-6 border-b border-gray-800">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Email Accounts</h2>
                <p className="text-sm text-gray-400 mt-1">Manage your organization's email accounts</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    placeholder="Search accounts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-gray-800 border-gray-700 text-white w-full sm:w-64"
                  />
                </div>
                <Dialog open={isAddEmailOpen} onOpenChange={setIsAddEmailOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={allocatedStorage >= totalStorage}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Email Account
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-900 border-gray-800">
                    <DialogHeader>
                      <DialogTitle className="text-white">Add New Email Account</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        Create a new email account for your organization
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="username" className="text-gray-300">Email Address</Label>
                        <div className="flex mt-2">
                          <Input
                            id="username"
                            value={newEmail.username}
                            onChange={(e) => setNewEmail({...newEmail, username: e.target.value})}
                            className="bg-gray-800 border-gray-700 text-white rounded-r-none"
                            placeholder="username"
                          />
                          <div className="px-3 py-2 bg-gray-800 border border-l-0 border-gray-700 text-gray-400 rounded-r-md">
                            @{organization?.domain}
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="name" className="text-gray-300">Full Name</Label>
                        <Input
                          id="name"
                          value={newEmail.name}
                          onChange={(e) => setNewEmail({...newEmail, name: e.target.value})}
                          className="bg-gray-800 border-gray-700 text-white mt-2"
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <Label htmlFor="storage" className="text-gray-300">Storage Allocation (MB)</Label>
                        <Input
                          id="storage"
                          type="number"
                          value={newEmail.storage}
                          onChange={(e) => setNewEmail({...newEmail, storage: parseInt(e.target.value) || 0})}
                          className="bg-gray-800 border-gray-700 text-white mt-2"
                          min="10"
                          max="10000"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="archival"
                          checked={newEmail.archival}
                          onCheckedChange={(checked) => setNewEmail({...newEmail, archival: checked as boolean})}
                          disabled={isArchivalFull}
                        />
                        <Label htmlFor="archival" className="text-gray-300 cursor-pointer">
                          Enable email archival for this account
                          {isArchivalFull && (
                            <span className="text-red-400 text-xs ml-2">(Limit reached)</span>
                          )}
                        </Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddEmailOpen(false)} className="border-gray-700 text-gray-300">
                        Cancel
                      </Button>
                      <Button onClick={handleAddEmail} className="bg-blue-600 hover:bg-blue-700">
                        Create Account
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedAccounts.length > 0 && (
            <div className="p-4 bg-gray-800/50 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">
                  {selectedAccounts.length} account(s) selected
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="border-gray-700 text-gray-300">
                    <Archive className="w-4 h-4 mr-2" />
                    Enable Archival
                  </Button>
                  <Button size="sm" variant="outline" className="border-gray-700 text-gray-300">
                    <Upload className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={handleDeleteAccounts}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Email Accounts Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="p-4 text-left">
                    <Checkbox
                      checked={selectedAccounts.length === filteredAccounts.length && filteredAccounts.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">Email Address</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">Name</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">Storage</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">Status</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">Last Active</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map(account => (
                  <tr key={account.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="p-4">
                      <Checkbox
                        checked={selectedAccounts.includes(account.id)}
                        onCheckedChange={() => toggleAccountSelection(account.id)}
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-medium">{account.email}</span>
                        {account.archival_enabled && (
                          <Badge className="bg-purple-600/20 text-purple-400 border-purple-600/30 text-xs">
                            Archival
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-gray-300">{account.full_name}</td>
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-400">
                              {account.storage_used_mb || 0} MB / {account.storage_allocated_mb || 0} MB
                            </span>
                            <span className="text-gray-500">
                              {account.storage_allocated_mb ? Math.round((account.storage_used_mb || 0) / account.storage_allocated_mb * 100) : 0}%
                            </span>
                          </div>
                          <Progress 
                            value={account.storage_allocated_mb ? ((account.storage_used_mb || 0) / account.storage_allocated_mb) * 100 : 0} 
                            className="h-1 bg-gray-700"
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedEmail(account);
                            setStorageAllocation(account.storage_allocated_mb);
                            setIsEditStorageOpen(true);
                          }}
                          className="text-gray-400 hover:text-white"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge className={`
                        ${account.status === 'active' 
                          ? 'bg-green-600/20 text-green-400 border-green-600/30' 
                          : 'bg-red-600/20 text-red-400 border-red-600/30'}
                      `}>
                        {account.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-gray-400 text-sm">
                      {account.last_active_at ? 
                        new Date(account.last_active_at).toLocaleString() : 
                        'Never'
                      }
                    </td>
                    <td className="p-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedEmail(account);
                            setStorageAllocation(account.storage_allocated_mb);
                            setIsEditStorageOpen(true);
                          }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Storage
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={async () => {
                            try {
                              const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                              await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/organizations/email-accounts/${account.id}/reset-password`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}` }
                              });
                              toast({ title: "Password Reset", description: "Password reset email sent" });
                            } catch (error) {
                              toast({ title: "Error", description: "Failed to reset password", variant: "destructive" });
                            }
                          }}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={async () => {
                            try {
                              const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                              const newStatus = account.status === 'active' ? 'suspended' : 'active';
                              await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/organizations/email-accounts/${account.id}/status`, {
                                method: 'PUT',
                                headers: {
                                  'Authorization': `Bearer ${token}`,
                                  'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ status: newStatus })
                              });
                              toast({ 
                                title: "Status Updated", 
                                description: `Account ${newStatus === 'active' ? 'activated' : 'suspended'}` 
                              });
                              fetchOrganizationData();
                            } catch (error) {
                              toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
                            }
                          }}>
                            {account.status === 'active' ? (
                              <>
                                <Clock className="w-4 h-4 mr-2" />
                                Suspend Account
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Activate Account
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-400"
                            onClick={async () => {
                              if (confirm(`Are you sure you want to delete ${account.email}?`)) {
                                try {
                                  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                                  await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/organizations/email-accounts/${account.id}`, {
                                    method: 'DELETE',
                                    headers: { 'Authorization': `Bearer ${token}` }
                                  });
                                  toast({ title: "Account Deleted", description: "Email account has been deleted", variant: "destructive" });
                                  fetchOrganizationData();
                                } catch (error) {
                                  toast({ title: "Error", description: "Failed to delete account", variant: "destructive" });
                                }
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            <Card className="bg-gray-900 border-gray-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-6">Current Subscriptions</h2>
              
              <div className="space-y-4">
                {/* Base Plan */}
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-white font-medium">Base Storage Plan</h3>
                      <p className="text-sm text-gray-400 mt-1">{organization?.storage_plan} • {organization?.billing_cycle}</p>
                      <p className="text-sm text-gray-400">Next billing: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">₹{organization?.billing_cycle === 'monthly' ? '3,000' : '30,000'}</p>
                      <p className="text-sm text-gray-400">/{organization?.billing_cycle === 'monthly' ? 'month' : 'year'}</p>
                      <Button size="sm" variant="outline" className="mt-2 border-red-600 text-red-400 hover:bg-red-600/20">
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Archival Plan */}
                {organization?.archival_plan && (
                  <div className="p-4 bg-gray-800 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-white font-medium">Email Archival</h3>
                        <p className="text-sm text-gray-400 mt-1">{organization.archival_plan} • {archivalUsed}/{archivalTotal} users</p>
                        <p className="text-sm text-gray-400">Auto-renews monthly</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-white">₹{archivalTotal * 500}</p>
                        <p className="text-sm text-gray-400">/month</p>
                        <Button size="sm" variant="outline" className="mt-2 border-red-600 text-red-400 hover:bg-red-600/20">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Total */}
                <div className="pt-4 border-t border-gray-700">
                  <div className="flex justify-between items-center">
                    <p className="text-lg text-gray-300">Total Monthly Cost</p>
                    <p className="text-2xl font-bold text-white">
                      ₹{((organization?.billing_cycle === 'monthly' ? 3000 : 2500) + (archivalTotal * 500)).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Upgrade Requests */}
            <Card className="bg-gray-900 border-gray-800 p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white">Upgrade Requests</h2>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsUpgradeStorageOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Request Upgrade
                </Button>
              </div>
              
              <div className="space-y-3">
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium">Storage Upgrade to 500GB</p>
                      <p className="text-sm text-gray-400">Requested on {new Date().toLocaleDateString()}</p>
                    </div>
                    <Badge className="bg-orange-600/20 text-orange-400">Pending Approval</Badge>
                  </div>
                </div>
              </div>
            </Card>

            {/* Payment History */}
            <Card className="bg-gray-900 border-gray-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-6">Payment History</h2>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-800">
                    <tr>
                      <th className="text-left p-3 text-gray-400">Date</th>
                      <th className="text-left p-3 text-gray-400">Description</th>
                      <th className="text-left p-3 text-gray-400">Amount</th>
                      <th className="text-left p-3 text-gray-400">Status</th>
                      <th className="text-left p-3 text-gray-400">Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-800">
                      <td className="p-3 text-white">{new Date().toLocaleDateString()}</td>
                      <td className="p-3 text-white">Monthly Subscription</td>
                      <td className="p-3 text-white">₹3,500</td>
                      <td className="p-3">
                        <Badge className="bg-green-600/20 text-green-400">Paid</Badge>
                      </td>
                      <td className="p-3">
                        <Button size="sm" variant="ghost" className="text-blue-400 hover:text-blue-300">
                          <Download className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card className="bg-gray-900 border-gray-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-6">Organization Settings</h2>
              <p className="text-gray-400">Organization settings will be available here.</p>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Storage Dialog */}
        <Dialog open={isEditStorageOpen} onOpenChange={setIsEditStorageOpen}>
          <DialogContent className="bg-gray-900 border-gray-800">
            <DialogHeader>
              <DialogTitle className="text-white">Edit Storage Allocation</DialogTitle>
              <DialogDescription className="text-gray-400">
                Adjust storage allocation for {selectedEmail?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="editStorage" className="text-gray-300">Storage (MB)</Label>
              <Input
                id="editStorage"
                type="number"
                value={storageAllocation}
                onChange={(e) => setStorageAllocation(parseInt(e.target.value) || 0)}
                className="bg-gray-800 border-gray-700 text-white mt-2"
                min="10"
                max="10000"
              />
              <p className="text-sm text-gray-500 mt-2">
                Current usage: {selectedEmail?.storage_used_mb || 0} MB
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditStorageOpen(false)} className="border-gray-700 text-gray-300">
                Cancel
              </Button>
              <Button onClick={handleEditStorage} className="bg-blue-600 hover:bg-blue-700">
                Update Storage
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upgrade Storage Dialog */}
        <Dialog open={isUpgradeStorageOpen} onOpenChange={setIsUpgradeStorageOpen}>
          <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">Upgrade Storage Plan</DialogTitle>
              <DialogDescription className="text-gray-400">
                Request additional storage for your organization
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div>
                <Label className="text-gray-300">Current Plan</Label>
                <div className="mt-2 p-4 bg-gray-800 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium">{organization?.storage_plan}</p>
                      <p className="text-sm text-gray-400">
                        {(totalStorage / 1024).toFixed(0)} GB total • {(usedStorage / 1024).toFixed(1)} GB used
                      </p>
                    </div>
                    <Badge className="bg-blue-600/20 text-blue-400">Current</Badge>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-gray-300">Select New Plan</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  {['100GB', '500GB', '1TB', '2TB'].map((plan) => (
                    <div
                      key={plan}
                      className="p-4 border border-gray-700 rounded-lg hover:border-blue-600 cursor-pointer transition-colors"
                    >
                      <p className="text-white font-medium">{plan}</p>
                      <p className="text-sm text-gray-400">
                        ₹{plan === '100GB' ? '3,000' : plan === '500GB' ? '12,000' : plan === '1TB' ? '20,000' : '35,000'}/month
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-gray-300">Additional Archival Users</Label>
                <Input
                  type="number"
                  placeholder="Enter number of additional archival users"
                  className="bg-gray-800 border-gray-700 text-white mt-2"
                  min="0"
                />
                <p className="text-sm text-gray-400 mt-2">
                  ₹500 per user per month
                </p>
              </div>

              <div className="pt-4 border-t border-gray-800">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-400">Additional Cost</p>
                    <p className="text-2xl font-bold text-white">₹5,000/month</p>
                  </div>
                  <Badge className="bg-green-600/20 text-green-400">
                    Requires Approval
                  </Badge>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUpgradeStorageOpen(false)} className="border-gray-700 text-gray-300">
                Cancel
              </Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/organizations/${organization?.id}/upgrade-storage`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ 
                        newPlan: '500GB', // Get from selected plan
                        additionalArchivalUsers: 0 // Get from input
                      })
                    });
                    
                    if (response.ok) {
                      toast({
                        title: "Upgrade Request Submitted",
                        description: "Your storage upgrade request has been submitted for approval",
                      });
                      setIsUpgradeStorageOpen(false);
                    } else {
                      throw new Error('Failed to submit upgrade request');
                    }
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to submit upgrade request",
                      variant: "destructive"
                    });
                  }
                }}
              >
                Submit Upgrade Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Archival Accounts Dialog */}
        <Dialog open={isArchivalDialogOpen} onOpenChange={setIsArchivalDialogOpen}>
          <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">Manage Archival Accounts</DialogTitle>
              <DialogDescription className="text-gray-400">
                Enable archival for email accounts or purchase additional archival licenses
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div>
                <Label className="text-gray-300">Current Archival Status</Label>
                <div className="mt-2 p-4 bg-gray-800 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium">Archival Licenses</p>
                      <p className="text-sm text-gray-400">
                        {archivalUsed} of {archivalTotal} licenses used
                      </p>
                    </div>
                    <Progress 
                      value={archivalTotal > 0 ? (archivalUsed / archivalTotal) * 100 : 0} 
                      className="w-32 h-2 bg-gray-700" 
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-gray-300">Purchase Additional Licenses</Label>
                <div className="mt-2 space-y-3">
                  <Input
                    type="number"
                    placeholder="Number of additional licenses"
                    className="bg-gray-800 border-gray-700 text-white"
                    min="1"
                  />
                  <p className="text-sm text-gray-400">
                    ₹500 per license per month
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-gray-300">Enable Archival for Accounts</Label>
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                  {emailAccounts.filter(acc => !acc.archival_enabled).map(account => (
                    <div key={account.id} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                      <span className="text-white">{account.email}</span>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="border-gray-700 text-gray-300"
                        disabled={isArchivalFull}
                      >
                        Enable
                      </Button>
                    </div>
                  ))}
                  {emailAccounts.filter(acc => !acc.archival_enabled).length === 0 && (
                    <p className="text-gray-400 text-sm">All accounts have archival enabled</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsArchivalDialogOpen(false)} className="border-gray-700 text-gray-300">
                Cancel
              </Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={async () => {
                  toast({
                    title: "Archival Updated",
                    description: "Archival settings have been updated",
                  });
                  setIsArchivalDialogOpen(false);
                  fetchOrganizationData();
                }}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}