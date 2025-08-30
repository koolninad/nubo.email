'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { 
  ArrowLeft, CheckCircle, XCircle, Clock, DollarSign,
  Building, Mail, Phone, Globe, HardDrive, Calendar,
  Shield, Archive, CreditCard, AlertCircle, FileText,
  User, MapPin, Hash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface OnboardingRequest {
  id: number;
  name: string;
  organization: string;
  email: string;
  phone: string;
  gst_number?: string;
  domain: string;
  storage_plan: string;
  billing_cycle: string;
  deployment_type: string;
  hybrid_provider?: string;
  archival_plan?: string;
  archival_users: number;
  email_accounts: any[];
  payment_details?: any;
  total_price: number;
  status: string;
  payment_status?: string;
  display_payment_status?: string;
  payment_date?: string;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  created_at: string;
  updated_at: string;
  rejection_reason?: string;
  reviewed_by?: number;
  reviewed_by_username?: string;
  reviewed_at?: string;
}

export default function OnboardingRequestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const requestId = params.id as string;
  
  const [request, setRequest] = useState<OnboardingRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchRequestDetails();
  }, [requestId]);

  const fetchRequestDetails = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/admin/onboarding-requests/${requestId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRequest(data.request);
      } else if (response.status === 404) {
        router.push('/admin/onboarding');
      }
    } catch (error) {
      console.error('Error fetching request details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setProcessing(true);
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
        await fetchRequestDetails();
        setShowApproveDialog(false);
      }
    } catch (error) {
      console.error('Error approving request:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;
    
    setProcessing(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/admin/onboarding-requests/${requestId}/review`, {
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
        await fetchRequestDetails();
        setShowRejectDialog(false);
        setRejectionReason('');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Request not found</div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { className: 'bg-orange-600/20 text-orange-400', icon: Clock },
      processing: { className: 'bg-blue-600/20 text-blue-400', icon: Clock },
      approved: { className: 'bg-green-600/20 text-green-400', icon: CheckCircle },
      rejected: { className: 'bg-red-600/20 text-red-400', icon: XCircle },
      completed: { className: 'bg-green-600/20 text-green-400', icon: CheckCircle }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={`${config.className} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status?: string) => {
    if (!status) return null;
    
    const statusConfig = {
      pending: { className: 'bg-orange-600/20 text-orange-400', label: 'Payment Pending' },
      paid: { className: 'bg-green-600/20 text-green-400', label: 'Paid' },
      failed: { className: 'bg-red-600/20 text-red-400', label: 'Payment Failed' },
      not_required: { className: 'bg-gray-600/20 text-gray-400', label: 'No Payment Required' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-gray-900/90 backdrop-blur-md border-b border-gray-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.push('/admin/onboarding')}
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Requests
              </Button>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-white">Onboarding Request #{request.id}</h1>
                {getStatusBadge(request.status)}
                {getPaymentStatusBadge(request.payment_status)}
              </div>
            </div>
            {request.status === 'pending' && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowRejectDialog(true)}
                  className="border-red-600 text-red-400 hover:bg-red-600/20"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => setShowApproveDialog(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </Button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Business Information */}
            <Card className="bg-gray-900 border-gray-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Building className="w-5 h-5 mr-2 text-blue-400" />
                Business Information
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">Organization Name</Label>
                  <p className="text-white font-medium">{request.organization}</p>
                </div>
                <div>
                  <Label className="text-gray-400">Domain</Label>
                  <p className="text-white font-medium flex items-center">
                    <Globe className="w-4 h-4 mr-1 text-gray-400" />
                    {request.domain}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-400">Contact Person</Label>
                  <p className="text-white font-medium flex items-center">
                    <User className="w-4 h-4 mr-1 text-gray-400" />
                    {request.name}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-400">Email</Label>
                  <p className="text-white font-medium flex items-center">
                    <Mail className="w-4 h-4 mr-1 text-gray-400" />
                    {request.email}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-400">Phone</Label>
                  <p className="text-white font-medium flex items-center">
                    <Phone className="w-4 h-4 mr-1 text-gray-400" />
                    {request.phone}
                  </p>
                </div>
                {request.gst_number && (
                  <div>
                    <Label className="text-gray-400">GST Number</Label>
                    <p className="text-white font-medium flex items-center">
                      <Hash className="w-4 h-4 mr-1 text-gray-400" />
                      {request.gst_number}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Plan Details */}
            <Card className="bg-gray-900 border-gray-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <HardDrive className="w-5 h-5 mr-2 text-green-400" />
                Plan Configuration
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">Storage Plan</Label>
                  <p className="text-white font-medium text-lg">{request.storage_plan}</p>
                </div>
                <div>
                  <Label className="text-gray-400">Billing Cycle</Label>
                  <p className="text-white font-medium">
                    {request.billing_cycle === 'monthly' ? 'Monthly' : 'Annual'}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-400">Deployment Type</Label>
                  <p className="text-white font-medium">
                    {request.deployment_type === 'hybrid' ? 'Hybrid' : 'Standard'}
                  </p>
                </div>
                {request.hybrid_provider && (
                  <div>
                    <Label className="text-gray-400">Hybrid Provider</Label>
                    <p className="text-white font-medium">{request.hybrid_provider}</p>
                  </div>
                )}
                {request.archival_plan && (
                  <div>
                    <Label className="text-gray-400">Archival Plan</Label>
                    <p className="text-white font-medium flex items-center">
                      <Archive className="w-4 h-4 mr-1 text-purple-400" />
                      {request.archival_plan} ({request.archival_users} users)
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Email Accounts */}
            <Card className="bg-gray-900 border-gray-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Mail className="w-5 h-5 mr-2 text-blue-400" />
                Email Accounts ({request.email_accounts?.length || 0})
              </h2>
              <div className="space-y-2">
                {request.email_accounts?.map((account: any, index: number) => (
                  <div key={index} className="bg-gray-800 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{account.email}</p>
                        <p className="text-sm text-gray-400">{account.fullName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-gray-700 text-gray-300">
                          {account.storage} MB
                        </Badge>
                        {account.archival && (
                          <Badge className="bg-purple-600/20 text-purple-400">
                            Archival
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Rejection Reason (if rejected) */}
            {request.status === 'rejected' && request.rejection_reason && (
              <Alert className="bg-red-900/20 border-red-600/30">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-400">
                  <strong>Rejection Reason:</strong> {request.rejection_reason}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Right Column - Payment & Timeline */}
          <div className="space-y-6">
            {/* Payment Details */}
            <Card className="bg-gray-900 border-gray-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-green-400" />
                Payment Information
              </h2>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-400">Total Amount</Label>
                  <p className="text-2xl font-bold text-white">₹{request.total_price?.toLocaleString()}</p>
                </div>
                
                <div className="pt-4 border-t border-gray-800">
                  <Label className="text-gray-400">Payment Status</Label>
                  <div className="mt-2">
                    {getPaymentStatusBadge(request.display_payment_status || request.payment_status || 'pending')}
                  </div>
                </div>

                {request.razorpay_payment_id && (
                  <div>
                    <Label className="text-gray-400">Payment ID</Label>
                    <p className="text-white font-mono text-sm">{request.razorpay_payment_id}</p>
                  </div>
                )}

                {request.razorpay_order_id && (
                  <div>
                    <Label className="text-gray-400">Order ID</Label>
                    <p className="text-white font-mono text-sm">{request.razorpay_order_id}</p>
                  </div>
                )}

                {request.payment_date && (
                  <div>
                    <Label className="text-gray-400">Payment Date</Label>
                    <p className="text-white">
                      {new Date(request.payment_date).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Timeline */}
            <Card className="bg-gray-900 border-gray-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-blue-400" />
                Timeline
              </h2>
              <div className="space-y-3">
                <div>
                  <Label className="text-gray-400">Submitted</Label>
                  <p className="text-white">
                    {new Date(request.created_at).toLocaleString()}
                  </p>
                </div>
                
                {request.reviewed_at && (
                  <div>
                    <Label className="text-gray-400">Reviewed</Label>
                    <p className="text-white">
                      {new Date(request.reviewed_at).toLocaleString()}
                      {request.reviewed_by_username && (
                        <span className="text-gray-400 text-sm ml-2">
                          by {request.reviewed_by_username}
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {request.updated_at !== request.created_at && (
                  <div>
                    <Label className="text-gray-400">Last Updated</Label>
                    <p className="text-white">
                      {new Date(request.updated_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Actions */}
            {request.status === 'approved' && (request.display_payment_status === 'unpaid' || (!request.razorpay_payment_id && !request.payment_status)) && (
              <Card className="bg-orange-900/20 border-orange-600/30 p-6">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-orange-400 mt-0.5" />
                  <div>
                    <p className="text-orange-400 font-medium">Awaiting Payment</p>
                    <p className="text-sm text-orange-400/80 mt-1">
                      This request has been approved but payment is still pending.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Approve Onboarding Request</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to approve this request for {request.organization}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">This will:</p>
              <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                <li>Create the organization account</li>
                <li>Set up {request.email_accounts?.length || 0} email accounts</li>
                <li>Allocate {request.storage_plan} of storage</li>
                {request.payment_status !== 'paid' && (
                  <li className="text-orange-400">Payment will still be required</li>
                )}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              disabled={processing}
              className="border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing ? 'Processing...' : 'Approve Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Reject Onboarding Request</DialogTitle>
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
              disabled={processing}
              className="border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={!rejectionReason.trim() || processing}
              className="bg-red-600 hover:bg-red-700"
            >
              {processing ? 'Processing...' : 'Reject Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}