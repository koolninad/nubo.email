'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Clock, CheckCircle, XCircle, Eye, 
  DollarSign, Server, Globe, Shield, Archive,
  Mail, Phone, Building, Calendar, Loader2,
  Search, Filter, RefreshCw, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OnboardingRequest {
  id: number;
  name: string;
  organization: string;
  email: string;
  phone: string;
  domain: string;
  storage_plan: string;
  billing_cycle: string;
  deployment_type: string;
  hybrid_provider?: string;
  archival_plan?: string;
  archival_users: number;
  email_accounts: any[];
  total_price: number;
  status: string;
  payment_status?: string;
  display_payment_status?: string;
  payment_date?: string;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  created_at: string;
  reviewed_at?: string;
}

export default function AdminOnboardingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<OnboardingRequest | null>(null);
  // const [showDetails, setShowDetails] = useState(false); // Removed - using navigation
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      router.push('/login');
    } else {
      fetchRequests();
    }
  }, []);

  // Fetch onboarding requests
  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/admin/onboarding-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Approve request
  const approveRequest = async (requestId: number) => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/admin/onboarding-requests/${requestId}/review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'approve' })
      });

      if (response.ok) {
        fetchRequests();
        // Navigation handled separately
      }
    } catch (error) {
      console.error('Error approving request:', error);
    }
  };

  // Reject request
  const rejectRequest = async () => {
    if (!selectedRequest) return;
    
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/admin/onboarding-requests/${selectedRequest.id}/review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          action: 'reject',
          reason: rejectionReason 
        })
      });

      if (response.ok) {
        fetchRequests();
        setShowRejectDialog(false);
        // setShowDetails(false); // Removed - using navigation
        setRejectionReason('');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  // Navigate to detail view
  const viewRequestDetails = (requestId: number) => {
    router.push(`/admin/onboarding/${requestId}`);
  };

  // Filter requests
  const filteredRequests = requests.filter(request => {
    const matchesSearch = 
      request.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.domain.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || request.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  // Calculate statistics
  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    processing: requests.filter(r => r.status === 'processing').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    totalRevenue: requests
      .filter(r => r.status === 'approved' || r.status === 'processing')
      .reduce((sum, r) => sum + (parseFloat(r.total_price) || 0), 0)
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
                <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-sm text-gray-400">Manage onboarding requests</p>
              </div>
            </div>
            <Button
              onClick={fetchRequests}
              variant="outline"
              className="border-gray-700"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card className="bg-gray-900 border-gray-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Requests</p>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
              <Users className="w-8 h-8 text-blue-400" />
            </div>
          </Card>

          <Card className="bg-gray-900 border-gray-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Pending</p>
                <p className="text-2xl font-bold text-orange-400">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-400" />
            </div>
          </Card>

          <Card className="bg-gray-900 border-gray-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Processing</p>
                <p className="text-2xl font-bold text-blue-400">{stats.processing}</p>
              </div>
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          </Card>

          <Card className="bg-gray-900 border-gray-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Approved</p>
                <p className="text-2xl font-bold text-green-400">{stats.approved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </Card>

          <Card className="bg-gray-900 border-gray-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Revenue</p>
                <p className="text-2xl font-bold text-white">₹{stats.totalRevenue.toLocaleString()}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-400" />
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-gray-900 border-gray-800 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by organization, email, or domain..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('all')}
                className={filterStatus === 'all' ? 'bg-blue-600' : 'border-gray-700'}
              >
                All
              </Button>
              <Button
                variant={filterStatus === 'pending' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('pending')}
                className={filterStatus === 'pending' ? 'bg-orange-600' : 'border-gray-700'}
              >
                Pending
              </Button>
              <Button
                variant={filterStatus === 'processing' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('processing')}
                className={filterStatus === 'processing' ? 'bg-blue-600' : 'border-gray-700'}
              >
                Processing
              </Button>
              <Button
                variant={filterStatus === 'approved' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('approved')}
                className={filterStatus === 'approved' ? 'bg-green-600' : 'border-gray-700'}
              >
                Approved
              </Button>
            </div>
          </div>
        </Card>

        {/* Requests Table */}
        <Card className="bg-gray-900 border-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-800">
                <tr>
                  <th className="text-left p-4 text-gray-400 font-medium">Organization</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Contact</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Plan</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Price</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Payment</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Date</th>
                  <th className="text-left p-4 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="p-4">
                      <div>
                        <p className="text-white font-medium">{request.organization}</p>
                        <p className="text-sm text-gray-400">{request.domain}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="text-white">{request.name}</p>
                        <p className="text-sm text-gray-400">{request.email}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="text-white">{request.storage_plan}</p>
                        <p className="text-sm text-gray-400">
                          {request.deployment_type === 'hybrid' ? 'Hybrid' : 'Standard'} • 
                          {request.billing_cycle === 'monthly' ? ' Monthly' : ' Annual'}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-white font-medium">₹{request.total_price.toLocaleString()}</p>
                    </td>
                    <td className="p-4">
                      <Badge 
                        variant={
                          request.status === 'pending' ? 'secondary' :
                          request.status === 'processing' ? 'default' :
                          request.status === 'approved' ? 'default' : 'destructive'
                        }
                        className={
                          request.status === 'pending' ? 'bg-orange-600/20 text-orange-400' :
                          request.status === 'processing' ? 'bg-blue-600/20 text-blue-400' :
                          request.status === 'approved' ? 'bg-green-600/20 text-green-400' : ''
                        }
                      >
                        {request.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {request.display_payment_status && (
                        <Badge 
                          variant={
                            request.display_payment_status === 'paid' ? 'default' :
                            request.display_payment_status === 'unpaid' ? 'secondary' : 'outline'
                          }
                          className={
                            request.display_payment_status === 'paid' ? 'bg-green-600/20 text-green-400 border-green-600' :
                            request.display_payment_status === 'unpaid' ? 'bg-red-600/20 text-red-400 border-red-600' :
                            'bg-gray-600/20 text-gray-400 border-gray-600'
                          }
                        >
                          <DollarSign className="w-3 h-3 mr-1" />
                          {request.display_payment_status}
                        </Badge>
                      )}
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-gray-400">
                        {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="p-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewRequestDetails(request.id)}
                        className="border-gray-700"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredRequests.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-gray-400">No requests found</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Request Details Dialog - Removed in favor of detail page */}
      {/* <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Onboarding Request Details</DialogTitle>
            <DialogDescription className="text-gray-400">
              Review and approve or reject this onboarding request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              {/* Business Details */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Business Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Organization</Label>
                    <p className="text-white">{selectedRequest.organization}</p>
                  </div>
                  <div>
                    <Label className="text-gray-400">Domain</Label>
                    <p className="text-white">{selectedRequest.domain}</p>
                  </div>
                  <div>
                    <Label className="text-gray-400">Contact Name</Label>
                    <p className="text-white">{selectedRequest.name}</p>
                  </div>
                  <div>
                    <Label className="text-gray-400">Email</Label>
                    <p className="text-white">{selectedRequest.email}</p>
                  </div>
                  <div>
                    <Label className="text-gray-400">Phone</Label>
                    <p className="text-white">{selectedRequest.phone}</p>
                  </div>
                  <div>
                    <Label className="text-gray-400">Status</Label>
                    <Badge 
                      className={
                        selectedRequest.status === 'pending' ? 'bg-orange-600/20 text-orange-400' :
                        selectedRequest.status === 'processing' ? 'bg-blue-600/20 text-blue-400' :
                        selectedRequest.status === 'approved' ? 'bg-green-600/20 text-green-400' : ''
                      }
                    >
                      {selectedRequest.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Plan Details */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Plan Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Storage Plan</Label>
                    <p className="text-white">{selectedRequest.storage_plan}</p>
                  </div>
                  <div>
                    <Label className="text-gray-400">Billing Cycle</Label>
                    <p className="text-white">{selectedRequest.billing_cycle === 'monthly' ? 'Monthly' : 'Annual'}</p>
                  </div>
                  <div>
                    <Label className="text-gray-400">Deployment Type</Label>
                    <p className="text-white">{selectedRequest.deployment_type === 'hybrid' ? 'Hybrid' : 'Standard'}</p>
                  </div>
                  {selectedRequest.hybrid_provider && (
                    <div>
                      <Label className="text-gray-400">Hybrid Provider</Label>
                      <p className="text-white">{selectedRequest.hybrid_provider}</p>
                    </div>
                  )}
                  {selectedRequest.archival_plan && (
                    <div>
                      <Label className="text-gray-400">Archival Plan</Label>
                      <p className="text-white">{selectedRequest.archival_plan} ({selectedRequest.archival_users} users)</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-gray-400">Total Price</Label>
                    <p className="text-white font-bold text-xl">₹{selectedRequest.total_price.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Email Accounts */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Email Accounts ({selectedRequest.email_accounts.length})</h3>
                <div className="space-y-2">
                  {selectedRequest.email_accounts.map((account: any, index: number) => (
                    <div key={index} className="bg-gray-800 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{account.email}</p>
                          <p className="text-sm text-gray-400">{account.fullName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-400">{account.storage} MB</p>
                          {account.archival && (
                            <Badge className="bg-purple-600/20 text-purple-400">Archival</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            {selectedRequest?.status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRejectDialog(true);
                  }}
                  className="border-red-600 text-red-400 hover:bg-red-600/20"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => approveRequest(selectedRequest.id)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog> */}

      {/* Reject Dialog - Keep this one */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription className="text-gray-400">
              Please provide a reason for rejecting this request
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Rejection Reason</Label>
              <Textarea
                id="reason"
                placeholder="Enter the reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              className="border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={rejectRequest}
              disabled={!rejectionReason}
              className="bg-red-600 hover:bg-red-700"
            >
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}