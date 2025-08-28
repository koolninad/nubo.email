'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Users,
  Mail,
  Database,
  Activity,
  Server,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  UserPlus,
  HardDrive
} from 'lucide-react';

interface DashboardData {
  users: {
    total_users: string;
    active_users: string;
    new_users_week: string;
    new_users_month: string;
    active_today: string;
    active_week: string;
  };
  accounts: {
    total_accounts: string;
    users_with_accounts: string;
    active_accounts: string;
    new_accounts_week: string;
    avg_accounts_per_user: string;
    max_accounts_per_user: string;
  };
  emails: {
    total_cached_emails: string;
    accounts_with_cache: string;
    emails_cached_today: string;
    emails_with_body: string;
    total_cache_size: string;
  };
  sync: {
    total_sync_jobs: string;
    running_jobs: string;
    completed_jobs: string;
    failed_jobs: string;
    jobs_last_hour: string;
    errors: Array<{
      folder: string;
      error_message: string;
      error_count: string;
      last_error: string;
    }>;
    backgroundStatus: {
      isRunning: boolean;
      totalAccounts: number;
      syncing: number;
      errors: number;
    };
  };
  storage: {
    database_size: string;
    emails_table_size: string;
    attachments_table_size: string;
  };
  providers: Array<{
    provider: string;
    count: string;
  }>;
}

export default function AdminDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchDashboard = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      
      console.log('Admin Dashboard - Token found:', !!token);
      
      if (!token) {
        console.log('No token found, redirecting to login');
        router.push('/login');
        return;
      }

      console.log('Fetching dashboard from API...');
      const response = await fetch('https://api.nubo.email/api/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });

      console.log('Response status:', response.status);

      if (response.status === 403) {
        setError('Admin access required');
        return;
      }

      if (response.status === 401) {
        console.log('Token expired, redirecting to login');
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        router.push('/login');
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to fetch dashboard: ${response.status}`);
      }

      const data = await response.json();
      console.log('Dashboard data received:', data);
      setDashboardData(data);
      setError(null);
    } catch (err: any) {
      console.error('Dashboard fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
        <p className="text-gray-600">Loading admin dashboard...</p>
        <p className="text-xs text-gray-500 mt-2">Fetching system metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Dashboard Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-y-2">
            <button 
              onClick={fetchDashboard}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Try Again
            </button>
            <button 
              onClick={() => router.push('/login')}
              className="w-full px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">System overview and metrics</p>
            </div>
            <button
              onClick={fetchDashboard}
              disabled={refreshing}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sync Status Alert */}
        <div className={`mb-6 rounded-lg p-4 ${
          dashboardData.sync.backgroundStatus.isRunning 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex items-center">
            <Activity className={`h-5 w-5 mr-3 ${
              dashboardData.sync.backgroundStatus.isRunning ? 'text-green-600' : 'text-yellow-600'
            }`} />
            <div className="flex-1">
              <h3 className="text-sm font-medium">
                Background Sync: {dashboardData.sync.backgroundStatus.isRunning ? 'Running' : 'Stopped'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {dashboardData.sync.backgroundStatus.totalAccounts} accounts tracked, 
                {' '}{dashboardData.sync.backgroundStatus.syncing} currently syncing
              </p>
            </div>
          </div>
        </div>

        {/* User Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.users.total_users}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-600">+{dashboardData.users.new_users_week} this week</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.users.active_users}</p>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-4 flex items-center text-sm">
              <Clock className="h-4 w-4 text-gray-500 mr-1" />
              <span className="text-gray-600">{dashboardData.users.active_today} today</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Email Accounts</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.accounts.total_accounts}</p>
              </div>
              <Mail className="h-8 w-8 text-purple-500" />
            </div>
            <div className="mt-4 flex items-center text-sm">
              <UserPlus className="h-4 w-4 text-blue-500 mr-1" />
              <span className="text-blue-600">~{Math.floor(parseFloat(dashboardData.accounts.avg_accounts_per_user))} per user</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cached Emails</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(parseInt(dashboardData.emails.total_cached_emails) / 1000).toFixed(1)}k
                </p>
              </div>
              <Database className="h-8 w-8 text-indigo-500" />
            </div>
            <div className="mt-4 flex items-center text-sm">
              <HardDrive className="h-4 w-4 text-gray-500 mr-1" />
              <span className="text-gray-600">{dashboardData.emails.total_cache_size || '0 B'}</span>
            </div>
          </div>
        </div>

        {/* Sync Jobs Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Sync Jobs (Last 24h)</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Completed</span>
                <span className="text-sm font-medium text-green-600">
                  <CheckCircle className="inline h-4 w-4 mr-1" />
                  {dashboardData.sync.completed_jobs}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Running</span>
                <span className="text-sm font-medium text-blue-600">
                  <RefreshCw className="inline h-4 w-4 mr-1 animate-spin" />
                  {dashboardData.sync.running_jobs}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Failed</span>
                <span className="text-sm font-medium text-red-600">
                  <AlertCircle className="inline h-4 w-4 mr-1" />
                  {dashboardData.sync.failed_jobs}
                </span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-sm text-gray-600">Jobs in last hour</span>
                <span className="text-sm font-medium text-gray-900">{dashboardData.sync.jobs_last_hour}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Providers</h3>
            <div className="space-y-2">
              {dashboardData.providers.map((provider) => (
                <div key={provider.provider} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{provider.provider}</span>
                  <span className="text-sm font-medium text-gray-900">{provider.count} accounts</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Storage Information */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Storage Usage</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600">Database Size</p>
              <p className="text-xl font-semibold text-gray-900">{dashboardData.storage.database_size}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Emails Table</p>
              <p className="text-xl font-semibold text-gray-900">{dashboardData.storage.emails_table_size}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Attachments Table</p>
              <p className="text-xl font-semibold text-gray-900">{dashboardData.storage.attachments_table_size}</p>
            </div>
          </div>
        </div>

        {/* Recent Errors */}
        {dashboardData.sync.errors.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Sync Errors</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Folder
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Error
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Occurrence
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dashboardData.sync.errors.map((error, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {error.folder}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {error.error_message.substring(0, 50)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {error.error_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(error.last_error).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 flex space-x-4">
          <button
            onClick={() => router.push('/admin/users')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Users className="h-4 w-4 mr-2" />
            Manage Users
          </button>
          <button
            onClick={() => router.push('/admin/sync')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            <Activity className="h-4 w-4 mr-2" />
            Sync Monitor
          </button>
          <button
            onClick={() => router.push('/admin/health')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Server className="h-4 w-4 mr-2" />
            System Health
          </button>
        </div>
      </div>
    </div>
  );
}