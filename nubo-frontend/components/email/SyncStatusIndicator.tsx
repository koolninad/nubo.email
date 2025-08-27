'use client';

import React from 'react';
import { RefreshCw, Check, AlertCircle, Clock, Wifi, WifiOff } from 'lucide-react';
import { useSyncStatus } from '@/hooks/useEmailCache';
import { formatDistanceToNow } from 'date-fns';

interface SyncStatusIndicatorProps {
  accountId?: number;
  compact?: boolean;
}

export default function SyncStatusIndicator({ accountId, compact = false }: SyncStatusIndicatorProps) {
  const { syncStatus, loading } = useSyncStatus(accountId);

  const getOverallStatus = () => {
    if (loading && syncStatus.length === 0) return 'loading';
    if (syncStatus.some(s => s.sync_in_progress)) return 'syncing';
    if (syncStatus.some(s => s.error_message)) return 'error';
    if (syncStatus.every(s => s.last_sync_at)) return 'synced';
    return 'idle';
  };

  const getStatusIcon = () => {
    const status = getOverallStatus();
    switch (status) {
      case 'loading':
      case 'syncing':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'synced':
        return <Check className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    const status = getOverallStatus();
    switch (status) {
      case 'loading':
        return 'Checking sync status...';
      case 'syncing':
        const syncingFolder = syncStatus.find(s => s.sync_in_progress);
        return `Syncing ${syncingFolder?.folder || 'emails'}...`;
      case 'error':
        const errorFolder = syncStatus.find(s => s.error_message);
        return `Sync error in ${errorFolder?.folder || 'folder'}`;
      case 'synced':
        const latest = syncStatus
          .filter(s => s.last_sync_at)
          .sort((a, b) => new Date(b.last_sync_at).getTime() - new Date(a.last_sync_at).getTime())[0];
        if (latest?.last_sync_at) {
          return `Last synced ${formatDistanceToNow(new Date(latest.last_sync_at), { addSuffix: true })}`;
        }
        return 'All synced';
      default:
        return 'Not synced';
    }
  };

  const getTotalStats = () => {
    const total = syncStatus.reduce((acc, s) => acc + (s.total_messages || 0), 0);
    const synced = syncStatus.reduce((acc, s) => acc + (s.synced_messages || 0), 0);
    return { total, synced };
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {getStatusIcon()}
        <span className="text-gray-600">{getStatusText()}</span>
      </div>
    );
  }

  const { total, synced } = getTotalStats();
  const overallStatus = getOverallStatus();

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Sync Status</h3>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className={`text-xs ${overallStatus === 'error' ? 'text-red-500' : 'text-gray-500'}`}>
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{synced.toLocaleString()} synced</span>
            <span>{total.toLocaleString()} total</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                overallStatus === 'error' ? 'bg-red-500' :
                overallStatus === 'syncing' ? 'bg-blue-500 animate-pulse' :
                'bg-green-500'
              }`}
              style={{ width: `${(synced / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Folder details */}
      <div className="space-y-2">
        {syncStatus.map((status) => (
          <div key={`${status.email_account_id}-${status.folder}`} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                status.sync_in_progress ? 'bg-blue-500 animate-pulse' :
                status.error_message ? 'bg-red-500' :
                status.last_sync_at ? 'bg-green-500' :
                'bg-gray-300'
              }`} />
              <span className="font-medium capitalize">{status.folder.toLowerCase()}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-500">
              {status.synced_messages !== undefined && (
                <span>{status.synced_messages}/{status.total_messages || 0}</span>
              )}
              {status.last_sync_at && !status.sync_in_progress && (
                <span>{formatDistanceToNow(new Date(status.last_sync_at), { addSuffix: true })}</span>
              )}
              {status.sync_in_progress && (
                <span className="text-blue-500">Syncing...</span>
              )}
              {status.error_message && (
                <span className="text-red-500" title={status.error_message}>Error</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Connection status */}
      <div className="mt-3 pt-3 border-t flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Wifi className="h-3 w-3" />
          <span>IMAP Connected</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-blue-600 hover:underline"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

// Mini version for header/sidebar
export function SyncStatusBadge({ accountId }: { accountId?: number }) {
  const { syncStatus } = useSyncStatus(accountId);
  
  const isSyncing = syncStatus.some(s => s.sync_in_progress);
  const hasError = syncStatus.some(s => s.error_message);
  
  if (hasError) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
        <AlertCircle className="h-3 w-3" />
        <span>Sync Error</span>
      </div>
    );
  }
  
  if (isSyncing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span>Syncing</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
      <Check className="h-3 w-3" />
      <span>Synced</span>
    </div>
  );
}