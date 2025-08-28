'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Activity,
  Database,
  Server,
  HardDrive,
  Cpu,
  MemoryStick,
  Wifi,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock
} from 'lucide-react';

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  uptime: number;
  services: {
    database: {
      status: 'healthy' | 'warning' | 'critical';
      responseTime: number;
      connections: number;
      maxConnections: number;
    };
    redis: {
      status: 'healthy' | 'warning' | 'critical';
      responseTime: number;
      memory: number;
      maxMemory: number;
      connectedClients: number;
    };
    backend: {
      status: 'healthy' | 'warning' | 'critical';
      responseTime: number;
      version: string;
      environment: string;
    };
    emailSync: {
      status: 'healthy' | 'warning' | 'critical';
      lastRun: string | null;
      nextRun: string | null;
      queueSize: number;
    };
  };
  resources: {
    cpu: {
      usage: number;
      cores: number;
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    disk: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  metrics: {
    totalUsers: number;
    activeUsers: number;
    totalEmails: number;
    emailsToday: number;
    apiCalls: number;
    avgResponseTime: number;
  };
  alerts: {
    level: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }[];
}

export default function SystemHealth() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const router = useRouter();

  const fetchSystemHealth = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('https://api.nubo.email/api/admin/system-health', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch system health');
      }

      const data = await response.json();
      setHealth(data);
    } catch (error) {
      console.error('Error fetching system health:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemHealth();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchSystemHealth, 10000); // Refresh every 10 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const getStatusColor = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5" />;
      case 'warning': return <AlertTriangle className="h-5 w-5" />;
      case 'critical': return <XCircle className="h-5 w-5" />;
      default: return null;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
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
                <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
                <p className="text-sm text-gray-600 mt-1">Monitor system performance and status</p>
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
                onClick={fetchSystemHealth}
                className="p-2 hover:bg-gray-100 rounded-md"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
              {health && (
                <div className={`flex items-center space-x-2 ${getStatusColor(health.status)}`}>
                  {getStatusIcon(health.status)}
                  <span className="font-medium capitalize">{health.status}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {health && (
          <>
            {/* Overall Status */}
            <div className="bg-white p-6 rounded-lg shadow mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">System Overview</h2>
                <div className="text-sm text-gray-700 font-medium bg-gray-100 px-3 py-1 rounded-md">
                  Uptime: {formatUptime(health.uptime)}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700 font-medium">Total Users</p>
                  <p className="text-3xl font-bold text-blue-600">{health.metrics.totalUsers}</p>
                </div>
                <div className="text-center bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700 font-medium">Active Users</p>
                  <p className="text-3xl font-bold text-green-600">{health.metrics.activeUsers}</p>
                </div>
                <div className="text-center bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700 font-medium">Total Emails</p>
                  <p className="text-3xl font-bold text-purple-600">{health.metrics.totalEmails.toLocaleString()}</p>
                </div>
                <div className="text-center bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700 font-medium">API Response Time</p>
                  <p className="text-3xl font-bold text-orange-600">{health.metrics.avgResponseTime}ms</p>
                </div>
              </div>
            </div>

            {/* Services Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Database */}
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between mb-4">
                  <Database className="h-8 w-8 text-blue-500" />
                  <div className={`flex items-center ${getStatusColor(health.services.database.status)}`}>
                    {getStatusIcon(health.services.database.status)}
                  </div>
                </div>
                <h3 className="font-semibold mb-2">Database</h3>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600">Response: {health.services.database.responseTime}ms</p>
                  <p className="text-gray-600">
                    Connections: {health.services.database.connections}/{health.services.database.maxConnections}
                  </p>
                </div>
              </div>

              {/* Redis */}
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between mb-4">
                  <Server className="h-8 w-8 text-red-500" />
                  <div className={`flex items-center ${getStatusColor(health.services.redis.status)}`}>
                    {getStatusIcon(health.services.redis.status)}
                  </div>
                </div>
                <h3 className="font-semibold mb-2">Redis Cache</h3>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600">Response: {health.services.redis.responseTime}ms</p>
                  <p className="text-gray-600">
                    Memory: {formatBytes(health.services.redis.memory)}/{formatBytes(health.services.redis.maxMemory)}
                  </p>
                  <p className="text-gray-600">Clients: {health.services.redis.connectedClients}</p>
                </div>
              </div>

              {/* Backend */}
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between mb-4">
                  <Wifi className="h-8 w-8 text-green-500" />
                  <div className={`flex items-center ${getStatusColor(health.services.backend.status)}`}>
                    {getStatusIcon(health.services.backend.status)}
                  </div>
                </div>
                <h3 className="font-semibold mb-2">Backend API</h3>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600">Response: {health.services.backend.responseTime}ms</p>
                  <p className="text-gray-600">Version: {health.services.backend.version}</p>
                  <p className="text-gray-600">Env: {health.services.backend.environment}</p>
                </div>
              </div>

              {/* Email Sync */}
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between mb-4">
                  <Clock className="h-8 w-8 text-purple-500" />
                  <div className={`flex items-center ${getStatusColor(health.services.emailSync.status)}`}>
                    {getStatusIcon(health.services.emailSync.status)}
                  </div>
                </div>
                <h3 className="font-semibold mb-2">Email Sync</h3>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600">Queue: {health.services.emailSync.queueSize} accounts</p>
                  <p className="text-gray-600">
                    Last: {health.services.emailSync.lastRun ? new Date(health.services.emailSync.lastRun).toLocaleTimeString() : 'Never'}
                  </p>
                </div>
              </div>
            </div>

            {/* System Resources */}
            <div className="bg-white p-6 rounded-lg shadow mb-8">
              <h2 className="text-lg font-semibold mb-4">System Resources</h2>
              <div className="space-y-4">
                {/* CPU */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">CPU Usage ({health.resources.cpu.cores} cores)</span>
                    <span className="text-sm text-gray-600">{health.resources.cpu.usage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        health.resources.cpu.usage > 80 ? 'bg-red-500' : 
                        health.resources.cpu.usage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${health.resources.cpu.usage}%` }}
                    />
                  </div>
                </div>

                {/* Memory */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">Memory Usage</span>
                    <span className="text-sm text-gray-600">
                      {formatBytes(health.resources.memory.used)} / {formatBytes(health.resources.memory.total)} ({health.resources.memory.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        health.resources.memory.percentage > 80 ? 'bg-red-500' : 
                        health.resources.memory.percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${health.resources.memory.percentage}%` }}
                    />
                  </div>
                </div>

                {/* Disk */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">Disk Usage</span>
                    <span className="text-sm text-gray-600">
                      {formatBytes(health.resources.disk.used)} / {formatBytes(health.resources.disk.total)} ({health.resources.disk.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        health.resources.disk.percentage > 80 ? 'bg-red-500' : 
                        health.resources.disk.percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${health.resources.disk.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Alerts */}
            {health.alerts.length > 0 && (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b">
                  <h2 className="text-lg font-semibold">Recent Alerts</h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {health.alerts.map((alert, index) => (
                    <div key={index} className="px-6 py-4 flex items-start space-x-3">
                      <div className={`mt-0.5 ${
                        alert.level === 'error' ? 'text-red-500' :
                        alert.level === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                      }`}>
                        {alert.level === 'error' ? <XCircle className="h-5 w-5" /> :
                         alert.level === 'warning' ? <AlertTriangle className="h-5 w-5" /> :
                         <Activity className="h-5 w-5" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{alert.message}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}