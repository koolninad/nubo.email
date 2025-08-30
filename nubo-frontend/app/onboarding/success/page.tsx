'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  CheckCircle, Clock, Mail, ArrowRight, Shield, 
  Users, Globe, Server, Headphones, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export default function OnboardingSuccessPage() {
  const router = useRouter();
  
  // Get order details from URL params or localStorage
  const [orderDetails, setOrderDetails] = useState({
    orderId: '',
    organization: '',
    domain: '',
    plan: '',
    billingCycle: '',
    totalPrice: 0
  });

  useEffect(() => {
    // Get order details from localStorage or URL params
    const storedDetails = localStorage.getItem('onboardingDetails');
    if (storedDetails) {
      const details = JSON.parse(storedDetails);
      setOrderDetails({
        orderId: details.orderId || `ORD-2025-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        organization: details.organization || 'Your Organization',
        domain: details.domain || 'yourdomain.com',
        plan: details.plan || '100GB',
        billingCycle: details.billingCycle || 'annually',
        totalPrice: details.totalPrice || 0
      });
      
      // Auto-login the user
      if (details.username && details.password) {
        loginUser(details.username, details.password, details.organizationId);
      }
    }
    
    // Redirect to organization admin after 5 seconds
    const timeout = setTimeout(() => {
      router.push('/org-admin');
    }, 5000);

    return () => clearTimeout(timeout);
  }, [router]);

  const loginUser = async (username: string, password: string, organizationId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Store token and user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (organizationId) {
          localStorage.setItem('organizationId', organizationId);
        }
        
        console.log('Auto-login successful');
      } else {
        console.error('Auto-login failed');
      }
    } catch (error) {
      console.error('Error during auto-login:', error);
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
              <span className="text-2xl font-bold text-white">Nubo.email</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Success Content */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 bg-green-600/20 rounded-full mb-6">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            
            <h1 className="text-4xl font-bold text-white mb-4">
              Welcome to Nubo Email!
            </h1>
            <p className="text-xl text-gray-400">
              Your request has been received and is being processed
            </p>
          </motion.div>

          {/* Status Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-gray-900 border-gray-800 p-8 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-white mb-2">Setup in Progress</h2>
                  <p className="text-gray-400">
                    Our team is setting up your email infrastructure
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center text-orange-400">
                    <Clock className="w-5 h-5 mr-2" />
                    <span className="font-semibold">Within 24 hours</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center mr-4">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">Order Received</p>
                    <p className="text-sm text-gray-500">Your payment has been processed successfully</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-4 animate-pulse">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">Setting up Infrastructure</p>
                    <p className="text-sm text-gray-500">Creating your email servers and storage</p>
                  </div>
                </div>

                <div className="flex items-center opacity-50">
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center mr-4">
                    <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-400 font-medium">Domain Configuration</p>
                    <p className="text-sm text-gray-600">Verifying DNS records and email routing</p>
                  </div>
                </div>

                <div className="flex items-center opacity-50">
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center mr-4">
                    <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-400 font-medium">Account Activation</p>
                    <p className="text-sm text-gray-600">Your email accounts will be ready to use</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Setup Progress</span>
                  <span className="text-sm text-gray-400">25%</span>
                </div>
                <Progress value={25} className="h-2 bg-gray-800" />
              </div>
            </Card>
          </motion.div>

          {/* What Happens Next */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-gray-900 border-gray-800 p-8 mb-8">
              <h3 className="text-xl font-semibold text-white mb-6">What Happens Next?</h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <Mail className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white mb-1">Email Notification</h4>
                    <p className="text-sm text-gray-400">
                      You'll receive an email once your account is fully activated
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <Users className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white mb-1">Admin Access</h4>
                    <p className="text-sm text-gray-400">
                      Manage your organization and email accounts from the admin panel
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <Globe className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white mb-1">Domain Verification</h4>
                    <p className="text-sm text-gray-400">
                      We'll verify your DNS records are properly configured
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-10 h-10 bg-orange-600/20 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <Headphones className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white mb-1">24/7 Support</h4>
                    <p className="text-sm text-gray-400">
                      Our support team is available to help with setup and migration
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Order Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="bg-gray-900 border-gray-800 p-8 mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">Order Details</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Order ID:</span>
                  <span className="text-white font-mono">{orderDetails.orderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Organization:</span>
                  <span className="text-white">{orderDetails.organization}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Domain:</span>
                  <span className="text-white">{orderDetails.domain}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Plan:</span>
                  <span className="text-white">{orderDetails.plan} Storage</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Billing Cycle:</span>
                  <span className="text-white">{orderDetails.billingCycle === 'monthly' ? 'Monthly' : 'Annual'}</span>
                </div>
                {orderDetails.totalPrice > 0 && (
                  <div className="flex justify-between pt-2 border-t border-gray-800">
                    <span className="text-gray-400">Total Amount:</span>
                    <span className="text-white font-bold">₹{orderDetails.totalPrice.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button
              size="lg"
              onClick={() => router.push('/org-admin')}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
            >
              Go to Admin Dashboard
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push('/help')}
              className="border-gray-700 text-gray-300 hover:text-white"
            >
              View Setup Guide
            </Button>
          </motion.div>

          {/* Auto-redirect notice */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-center mt-8"
          >
            <p className="text-sm text-gray-500">
              You will be automatically redirected to the admin dashboard in a few seconds...
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}