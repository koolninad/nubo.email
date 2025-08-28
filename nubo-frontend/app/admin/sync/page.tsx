'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface SyncStatus {
  isRunning: boolean;
  lastSync: string | null;
  nextSync: string | null;
  totalAccounts: number;
  syncedAccounts: number;
  failedAccounts: number;
  pendingAccounts: number;
  averageSyncTime: number;
  recentSyncs: {
    accountId: number;
    username: string;
    email: string;
    status: 'success' | 'failed' | 'in_progress';
    startTime: string;
    endTime: string | null;
    emailsSynced: number;
    error: string | null;
  }[];
}

export default function SyncMonitor() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const router = useRouter();

  const fetchSyncStatus = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('https://api.nubo.email/api/admin/sync-status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sync status');
      }

      const data = await response.json();
      setSyncStatus(data);
    } catch (error) {
      console.error('Error fetching sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSyncStatus();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchSyncStatus, 5000); // Refresh every 5 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const triggerManualSync = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      
      const response = await fetch('https://api.nubo.email/api/admin/trigger-sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        fetchSyncStatus();
      }
    } catch (error) {
      console.error('Error triggering sync:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/admin')}
                className="mr-4 p-2 hover:bg-gray-100 rounded-md"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Sync Monitor</h1>
                <p className="text-sm text-gray-600 mt-1">Background email synchronization status</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-600">Auto-refresh</span>
              </label>
              <button
                onClick={triggerManualSync}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Trigger Sync
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {syncStatus && (
          <>
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700 font-medium">Sync Status</p>
                    <p className="text-3xl font-bold mt-1 text-gray-900">
                      {syncStatus.isRunning ? 'Running' : 'Idle'}
                    </p>
                  </div>
                  <Activity className={`h-10 w-10 ${syncStatus.isRunning ? 'text-green-500 animate-pulse' : 'text-gray-400'}`} />
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700 font-medium">Total Accounts</p>
                    <p className="text-3xl font-bold mt-1 text-blue-600">{syncStatus.totalAccounts}</p>
                  </div>
                  <Clock className="h-10 w-10 text-blue-500" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border-l-4 border-emerald-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700 font-medium">Success Rate</p>
                    <p className="text-3xl font-bold mt-1 text-emerald-600">
                      {syncStatus.totalAccounts > 0 
                        ? `${Math.round((syncStatus.syncedAccounts / syncStatus.totalAccounts) * 100)}%`
                        : '0%'}
                    </p>
                  </div>
                  <CheckCircle className="h-10 w-10 text-emerald-500" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700 font-medium">Failed Syncs</p>
                    <p className="text-3xl font-bold mt-1 text-red-600">{syncStatus.failedAccounts}</p>
                  </div>
                  <XCircle className="h-10 w-10 text-red-500" />
                </div>
              </div>
            </div>

            {/* Timing Information */}
            <div className="bg-white p-6 rounded-lg shadow mb-8">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Sync Schedule</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700 font-medium">Last Sync</p>
                  <p className="font-semibold text-gray-900 mt-1">
                    {syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString() : 'Never'}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700 font-medium">Next Sync</p>
                  <p className="font-semibold text-blue-700 mt-1">
                    {syncStatus.nextSync ? new Date(syncStatus.nextSync).toLocaleString() : 'Not scheduled'}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700 font-medium">Average Sync Time</p>
                  <p className="font-semibold text-green-700 mt-1">{syncStatus.averageSyncTime}s</p>
                </div>
              </div>
            </div>

            {/* Recent Syncs */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold">Recent Sync Activity</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Emails Synced
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {syncStatus.recentSyncs.map((sync, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{sync.username}</div>
                            <div className="text-sm text-gray-500">{sync.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {sync.status === 'success' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Success
                            </span>
                          )}
                          {sync.status === 'failed' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </span>
                          )}
                          {sync.status === 'in_progress' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              In Progress
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {sync.emailsSynced}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(sync.startTime).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {sync.endTime 
                            ? `${Math.round((new Date(sync.endTime).getTime() - new Date(sync.startTime).getTime()) / 1000)}s`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {syncStatus.recentSyncs.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No recent sync activity
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}