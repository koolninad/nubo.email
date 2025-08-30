'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building, Mail, Phone, FileText, Globe, CreditCard, 
  Check, ChevronRight, ArrowLeft, ArrowRight, Shield,
  Server, Database, Users, HardDrive, Archive, Calculator,
  Copy, ExternalLink, AlertCircle, Loader2, IndianRupee, CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

const steps = [
  { id: 1, name: 'Business Details', icon: Building },
  { id: 2, name: 'Select Plan', icon: Calculator },
  { id: 3, name: 'Domain Setup', icon: Globe },
  { id: 4, name: 'Email Allocation', icon: Users },
  { id: 5, name: 'Payment', icon: CreditCard },
];

// Pricing data
const storagePlans = {
  '5GB': { annual: 1999, monthly: 216 },
  '25GB': { annual: 6999, monthly: 759 },
  '100GB': { annual: 22999, monthly: 2491 },
  '500GB': { annual: 89999, monthly: 9750 },
  '1TB': { annual: 169999, monthly: 18416 }
};

const archivalPlans = {
  basic: { name: 'Basic (1 year)', price: 49 },
  professional: { name: 'Professional (3 years)', price: 99 },
  enterprise: { name: 'Enterprise (Unlimited)', price: 199 }
};

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Step 1: Business Details
  const [businessDetails, setBusinessDetails] = useState({
    name: '',
    organization: '',
    email: '',
    phone: '',
    gst: '',
    domain: '',
    username: '',
    password: '',
    confirmPassword: ''
  });

  // Step 2: Plan Selection
  const [selectedPlan, setSelectedPlan] = useState('100GB');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('annually');
  const [deploymentType, setDeploymentType] = useState<'standard' | 'hybrid'>('standard');
  const [hybridProvider, setHybridProvider] = useState<'google' | 'office365'>('google');
  const [archivalPlan, setArchivalPlan] = useState<string>('');
  const [archivalUsers, setArchivalUsers] = useState(0);

  // Step 3: Domain Configuration
  const [domainVerified, setDomainVerified] = useState(false);
  const [skipDomainSetup, setSkipDomainSetup] = useState(false);

  // Step 4: Email Allocation
  const [emailAccounts, setEmailAccounts] = useState<Array<{
    email: string;
    allocatedStorage: number;
    migration: boolean;
    archival: boolean;
  }>>([]);
  const [totalStorageUsed, setTotalStorageUsed] = useState(0);

  // Step 5: Payment
  const [paymentDetails, setPaymentDetails] = useState({
    cardNumber: '',
    cardName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    billingAddress: ''
  });

  // Calculate total storage in MB
  const getTotalStorageInMB = () => {
    const storage = selectedPlan;
    if (storage.includes('GB')) {
      return parseInt(storage) * 1024;
    } else if (storage.includes('TB')) {
      return parseInt(storage) * 1024 * 1024;
    }
    return 0;
  };

  // Calculate pricing
  const calculateTotalPrice = () => {
    const basePlan = storagePlans[selectedPlan as keyof typeof storagePlans];
    const basePrice = billingCycle === 'monthly' ? basePlan.monthly : basePlan.annual;
    
    let archivalPrice = 0;
    if (archivalPlan && archivalUsers > 0) {
      const archival = archivalPlans[archivalPlan as keyof typeof archivalPlans];
      // Calculate archival price based on billing cycle
      if (billingCycle === 'monthly') {
        archivalPrice = archival.price * archivalUsers;
      } else {
        // Annual price with discount (12 months for price of 10)
        archivalPrice = archival.price * archivalUsers * 10;
      }
    }
    
    return basePrice + archivalPrice;
  };

  // Handle step navigation
  const nextStep = () => {
    console.log('Next button clicked, currentStep:', currentStep);
    console.log('Business details:', businessDetails);
    if (validateCurrentStep()) {
      if (currentStep === 3 && skipDomainSetup) {
        setCurrentStep(4);
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const prevStep = () => {
    if (currentStep === 4 && skipDomainSetup) {
      setCurrentStep(2);
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  // Validate current step
  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        console.log('Validating step 1, businessDetails:', businessDetails);
        
        // Check each field individually for better error messages
        if (!businessDetails.name) {
          toast({
            title: "Missing Name",
            description: "Please enter your full name",
            variant: "destructive"
          });
          return false;
        }
        if (!businessDetails.organization) {
          toast({
            title: "Missing Organization",
            description: "Please enter your organization name",
            variant: "destructive"
          });
          return false;
        }
        if (!businessDetails.email) {
          toast({
            title: "Missing Email",
            description: "Please enter your email address",
            variant: "destructive"
          });
          return false;
        }
        if (!businessDetails.email.includes('@')) {
          toast({
            title: "Invalid Email Format",
            description: "Email must include @ symbol (e.g., user@example.com)",
            variant: "destructive"
          });
          return false;
        }
        if (!businessDetails.phone) {
          toast({
            title: "Missing Phone",
            description: "Please enter your phone number",
            variant: "destructive"
          });
          return false;
        }
        if (!businessDetails.domain) {
          toast({
            title: "Missing Domain",
            description: "Please enter your domain name",
            variant: "destructive"
          });
          return false;
        }
        if (!businessDetails.username) {
          toast({
            title: "Missing Username",
            description: "Please enter a username for your admin account",
            variant: "destructive"
          });
          return false;
        }
        if (!businessDetails.password) {
          toast({
            title: "Missing Password",
            description: "Please enter a password for your admin account",
            variant: "destructive"
          });
          return false;
        }
        if (businessDetails.password && businessDetails.password.length < 8) {
          toast({
            title: "Weak Password",
            description: "Password must be at least 8 characters long",
            variant: "destructive"
          });
          return false;
        }
        if (businessDetails.password && businessDetails.confirmPassword && 
            businessDetails.password !== businessDetails.confirmPassword) {
          toast({
            title: "Password Mismatch",
            description: "Passwords do not match",
            variant: "destructive"
          });
          return false;
        }
        return true;
      
      case 2:
        if (deploymentType === 'hybrid' && !hybridProvider) {
          toast({
            title: "Select Provider",
            description: "Please select your existing email provider",
            variant: "destructive"
          });
          return false;
        }
        return true;
      
      case 3:
        if (!skipDomainSetup && !domainVerified) {
          toast({
            title: "Domain Not Verified",
            description: "Please verify your domain or choose to skip this step",
            variant: "destructive"
          });
          return false;
        }
        return true;
      
      case 4:
        if (emailAccounts.length === 0) {
          toast({
            title: "No Email Accounts",
            description: "Please add at least one email account",
            variant: "destructive"
          });
          return false;
        }
        if (totalStorageUsed > getTotalStorageInMB()) {
          toast({
            title: "Storage Exceeded",
            description: "Total allocated storage exceeds your plan limit",
            variant: "destructive"
          });
          return false;
        }
        return true;
      
      case 5:
        if (!paymentDetails.cardNumber || !paymentDetails.cardName || 
            !paymentDetails.expiryMonth || !paymentDetails.expiryYear || !paymentDetails.cvv) {
          toast({
            title: "Payment Information Required",
            description: "Please fill in all payment details",
            variant: "destructive"
          });
          return false;
        }
        return true;
      
      default:
        return true;
    }
  };

  // Add email account
  const addEmailAccount = () => {
    const newEmail = {
      email: '',
      allocatedStorage: 100, // Default 100MB
      migration: false,
      archival: false
    };
    setEmailAccounts([...emailAccounts, newEmail]);
  };

  // Update email account
  const updateEmailAccount = (index: number, field: string, value: any) => {
    const updated = [...emailAccounts];
    updated[index] = { ...updated[index], [field]: value };
    setEmailAccounts(updated);
    
    // Recalculate total storage
    const total = updated.reduce((sum, acc) => sum + acc.allocatedStorage, 0);
    setTotalStorageUsed(total);
  };

  // Remove email account
  const removeEmailAccount = (index: number) => {
    const updated = emailAccounts.filter((_, i) => i !== index);
    setEmailAccounts(updated);
    
    const total = updated.reduce((sum, acc) => sum + acc.allocatedStorage, 0);
    setTotalStorageUsed(total);
  };

  // Process payment and complete onboarding
  const completeOnboarding = async () => {
    console.log('Complete Purchase clicked');
    console.log('Terms accepted:', termsAccepted);
    console.log('Business details:', businessDetails);
    
    setIsLoading(true);
    
    try {
      
      // Submit onboarding request
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/onboarding/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessDetails,
          planSelection: {
            storage: selectedPlan,
            billingCycle,
            deploymentType,
            hybridProvider,
            archivalPlan: archivalPlan,
            archivalUsers
          },
          domainConfig: {
            domainVerified,
            skipDomainSetup
          },
          emailAccounts,
          totalPrice: calculateTotalPrice()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit onboarding request');
      }

      const data = await response.json();

      // Initialize Razorpay
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        const options = {
          key: data.keyId,
          amount: data.amount,
          currency: data.currency,
          order_id: data.razorpayOrderId,
          name: 'Nubo Email',
          description: `${selectedPlan} Storage Plan - ${billingCycle === 'monthly' ? 'Monthly' : 'Annual'} Billing`,
          handler: async function (response: any) {
            // Verify payment
            const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/onboarding/verify-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                requestId: data.requestId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature
              })
            });

            if (verifyResponse.ok) {
              const verifyData = await verifyResponse.json();
              // Store order details and credentials for success page
              localStorage.setItem('onboardingDetails', JSON.stringify({
                orderId: data.requestId,
                organization: businessDetails.organization,
                domain: businessDetails.domain,
                plan: selectedPlan,
                billingCycle,
                totalPrice: calculateTotalPrice(),
                organizationId: verifyData.organizationId,
                username: businessDetails.username,
                password: businessDetails.password // For auto-login
              }));
              // Redirect to success page
              router.push('/onboarding/success');
            } else {
              throw new Error('Payment verification failed');
            }
          },
          prefill: {
            name: businessDetails.name,
            email: businessDetails.email,
            contact: businessDetails.phone
          },
          theme: {
            color: '#0066CC'
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      };
    } catch (error) {
      console.error('Error in completeOnboarding:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete onboarding. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    });
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
            <Button 
              variant="ghost" 
              className="text-gray-300 hover:text-white"
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </nav>

      {/* Progress Steps */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center transition-all
                      ${isActive ? 'bg-blue-600 text-white' : 
                        isCompleted ? 'bg-green-600 text-white' : 
                        'bg-gray-800 text-gray-500'}
                    `}>
                      {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                    </div>
                    <span className={`text-sm mt-2 ${isActive ? 'text-white' : 'text-gray-500'}`}>
                      {step.name}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`
                      w-20 h-0.5 mx-4 transition-all
                      ${currentStep > step.id ? 'bg-green-600' : 'bg-gray-700'}
                    `} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {/* Step 1: Business Details */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Business Details</h2>
                  <p className="text-gray-400">Tell us about your organization</p>
                </div>

                <Card className="bg-gray-900 border-gray-800 p-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="name" className="text-gray-300">Your Name *</Label>
                      <Input
                        id="name"
                        value={businessDetails.name}
                        onChange={(e) => setBusinessDetails({...businessDetails, name: e.target.value})}
                        className="bg-gray-800 border-gray-700 text-white"
                        placeholder="John Doe"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="organization" className="text-gray-300">Organization Name *</Label>
                      <Input
                        id="organization"
                        value={businessDetails.organization}
                        onChange={(e) => setBusinessDetails({...businessDetails, organization: e.target.value})}
                        className="bg-gray-800 border-gray-700 text-white"
                        placeholder="Acme Corporation"
                      />
                    </div>

                    <div>
                      <Label htmlFor="email" className="text-gray-300">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={businessDetails.email}
                        onChange={(e) => setBusinessDetails({...businessDetails, email: e.target.value})}
                        className="bg-gray-800 border-gray-700 text-white"
                        placeholder="admin@example.com"
                      />
                    </div>

                    <div>
                      <Label htmlFor="phone" className="text-gray-300">Phone Number *</Label>
                      <Input
                        id="phone"
                        value={businessDetails.phone}
                        onChange={(e) => setBusinessDetails({...businessDetails, phone: e.target.value})}
                        className="bg-gray-800 border-gray-700 text-white"
                        placeholder="+91 98765 43210"
                      />
                    </div>

                    <div>
                      <Label htmlFor="gst" className="text-gray-300">GST Number (Optional)</Label>
                      <Input
                        id="gst"
                        value={businessDetails.gst}
                        onChange={(e) => setBusinessDetails({...businessDetails, gst: e.target.value})}
                        className="bg-gray-800 border-gray-700 text-white"
                        placeholder="29ABCDE1234F1Z5"
                      />
                    </div>

                    <div>
                      <Label htmlFor="domain" className="text-gray-300">Domain Name *</Label>
                      <Input
                        id="domain"
                        value={businessDetails.domain}
                        onChange={(e) => setBusinessDetails({...businessDetails, domain: e.target.value})}
                        className="bg-gray-800 border-gray-700 text-white"
                        placeholder="example.com"
                      />
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-800">
                    <h3 className="text-lg font-semibold text-white mb-4">Admin Account Details</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="username" className="text-gray-300">Username *</Label>
                        <Input
                          id="username"
                          value={businessDetails.username}
                          onChange={(e) => setBusinessDetails({...businessDetails, username: e.target.value})}
                          className="bg-gray-800 border-gray-700 text-white"
                          placeholder="admin_username"
                        />
                      </div>

                      <div>
                        <Label htmlFor="password" className="text-gray-300">Password *</Label>
                        <Input
                          id="password"
                          type="password"
                          value={businessDetails.password}
                          onChange={(e) => setBusinessDetails({...businessDetails, password: e.target.value})}
                          className="bg-gray-800 border-gray-700 text-white"
                          placeholder="Enter a strong password"
                        />
                      </div>

                      <div>
                        <Label htmlFor="confirmPassword" className="text-gray-300">Confirm Password *</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={businessDetails.confirmPassword}
                          onChange={(e) => setBusinessDetails({...businessDetails, confirmPassword: e.target.value})}
                          className="bg-gray-800 border-gray-700 text-white"
                          placeholder="Re-enter your password"
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Step 2: Plan Selection */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Select Your Plan</h2>
                  <p className="text-gray-400">Choose the perfect plan for your organization</p>
                </div>

                {/* Billing Cycle */}
                <Card className="bg-gray-900 border-gray-800 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Billing Cycle</h3>
                  <RadioGroup 
                    value={billingCycle} 
                    onValueChange={(value: 'monthly' | 'annually') => setBillingCycle(value)}
                    className="flex space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="monthly" id="monthly" />
                      <Label htmlFor="monthly" className="text-gray-300 cursor-pointer">
                        Monthly
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="annually" id="annually" />
                      <Label htmlFor="annually" className="text-gray-300 cursor-pointer">
                        Annually <span className="text-green-400 ml-1">(Save 30%)</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </Card>

                {/* Storage Plan */}
                <Card className="bg-gray-900 border-gray-800 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Storage Plan</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    {Object.entries(storagePlans).slice(0, 5).map(([storage, prices]) => (
                      <div 
                        key={storage}
                        onClick={() => setSelectedPlan(storage)}
                        className={`
                          p-4 rounded-lg border-2 cursor-pointer transition-all
                          ${selectedPlan === storage 
                            ? 'border-blue-500 bg-blue-500/10' 
                            : 'border-gray-700 hover:border-gray-600'}
                        `}
                      >
                        <div className="text-2xl font-bold text-white">{storage}</div>
                        <div className="text-xl text-blue-400 mt-2">
                          ₹{billingCycle === 'monthly' ? prices.monthly : prices.annual}
                          <span className="text-sm text-gray-500">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
                        </div>
                        <div className="text-sm text-gray-400 mt-2">Unlimited Users</div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Deployment Type */}
                <Card className="bg-gray-900 border-gray-800 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Deployment Type</h3>
                  <RadioGroup 
                    value={deploymentType} 
                    onValueChange={(value: 'standard' | 'hybrid') => setDeploymentType(value)}
                    className="space-y-4"
                  >
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="standard" id="standard" className="mt-1" />
                      <div>
                        <Label htmlFor="standard" className="text-gray-300 cursor-pointer">
                          <div className="font-semibold">Standard Deployment</div>
                          <div className="text-sm text-gray-500">All emails on Nubo platform</div>
                        </Label>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="hybrid" id="hybrid" className="mt-1" />
                      <div>
                        <Label htmlFor="hybrid" className="text-gray-300 cursor-pointer">
                          <div className="font-semibold">Hybrid Deployment</div>
                          <div className="text-sm text-gray-500">Keep some emails on Google/Office 365</div>
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>

                  {deploymentType === 'hybrid' && (
                    <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                      <Label className="text-gray-300 mb-2 block">Your existing provider:</Label>
                      <RadioGroup 
                        value={hybridProvider} 
                        onValueChange={(value: 'google' | 'office365') => setHybridProvider(value)}
                        className="flex space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="google" id="google" />
                          <Label htmlFor="google" className="text-gray-300 cursor-pointer">
                            Google Workspace
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="office365" id="office365" />
                          <Label htmlFor="office365" className="text-gray-300 cursor-pointer">
                            Office 365
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}
                </Card>

                {/* Email Archival Add-on */}
                <Card className="bg-gray-900 border-gray-800 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Email Archival Add-on <span className="text-sm text-gray-500">(Optional)</span>
                  </h3>
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    {Object.entries(archivalPlans).map(([key, plan]) => (
                      <div 
                        key={key}
                        onClick={() => setArchivalPlan(archivalPlan === key ? '' : key)}
                        className={`
                          p-4 rounded-lg border-2 cursor-pointer transition-all
                          ${archivalPlan === key 
                            ? 'border-purple-500 bg-purple-500/10' 
                            : 'border-gray-700 hover:border-gray-600'}
                        `}
                      >
                        <div className="font-semibold text-white">{plan.name}</div>
                        <div className="text-xl text-purple-400 mt-2">
                          ₹{billingCycle === 'monthly' ? plan.price : plan.price * 10}
                          <span className="text-sm text-gray-500">/user/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
                        </div>
                        {billingCycle === 'annually' && (
                          <div className="text-xs text-green-400 mt-1">Save 2 months!</div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {archivalPlan && (
                    <div>
                      <Label htmlFor="archivalUsers" className="text-gray-300">Number of users for archival</Label>
                      <Input
                        id="archivalUsers"
                        type="number"
                        min="0"
                        value={archivalUsers}
                        onChange={(e) => setArchivalUsers(parseInt(e.target.value) || 0)}
                        className="bg-gray-800 border-gray-700 text-white w-32"
                      />
                    </div>
                  )}
                </Card>

                {/* Total Price */}
                <Card className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-blue-500/30 p-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Total Price</h3>
                      <p className="text-sm text-gray-400">
                        {selectedPlan} storage + {archivalUsers > 0 ? `${archivalUsers} archival users` : 'No archival'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-white">
                        ₹{calculateTotalPrice().toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-400">
                        per {billingCycle === 'monthly' ? 'month' : 'year'}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Step 3: Domain Configuration */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Domain Configuration</h2>
                  <p className="text-gray-400">Configure your domain to work with Nubo email</p>
                </div>

                <Alert className="bg-blue-950/50 border-blue-800">
                  <AlertCircle className="h-4 w-4 text-blue-400" />
                  <AlertDescription className="text-gray-300">
                    Add these DNS records to your domain. DNS changes can take up to 48 hours to propagate.
                  </AlertDescription>
                </Alert>

                {/* MX Records */}
                <Card className="bg-gray-900 border-gray-800 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">MX Records</h3>
                  <div className="space-y-3">
                    {[
                      { host: '@', value: 'mx0.nubo.email', priority: '0' },
                      { host: '@', value: 'mx1.nubo.email', priority: '5' },
                      { host: '@', value: 'mx2.nubo.email', priority: '5' },
                      { host: '@', value: 'mx10.nubo.email', priority: '10' },
                    ].map((record, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                        <div className="flex-1 grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Host:</span>
                            <span className="text-white ml-2 font-mono">{record.host}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Value:</span>
                            <span className="text-white ml-2 font-mono">{record.value}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Priority:</span>
                            <span className="text-white ml-2 font-mono">{record.priority}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(`${record.host} ${record.value} ${record.priority}`)}
                          className="text-gray-400 hover:text-white"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* SPF Record */}
                <Card className="bg-gray-900 border-gray-800 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">SPF Record (TXT)</h3>
                  <div className="p-3 bg-gray-800 rounded-lg flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-gray-500">Value:</span>
                      <span className="text-white ml-2 font-mono">"v=spf1 include:smtp.spf1.nubo.email ~all"</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard('"v=spf1 include:smtp.spf1.nubo.email ~all"')}
                      className="text-gray-400 hover:text-white"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>

                {/* Email Configuration */}
                <Card className="bg-gray-900 border-gray-800 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Email Client Configuration</h3>
                  
                  <Tabs defaultValue="ssl" className="w-full">
                    <TabsList className="bg-gray-800">
                      <TabsTrigger value="ssl">SSL/TLS</TabsTrigger>
                      <TabsTrigger value="starttls">STARTTLS</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="ssl" className="space-y-3 mt-4">
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="p-3 bg-gray-800 rounded-lg">
                          <div className="text-xs text-gray-500 mb-1">IMAP</div>
                          <div className="text-white font-mono">imap.nubo.email</div>
                          <div className="text-sm text-gray-400">Port: 993 (SSL/TLS)</div>
                        </div>
                        <div className="p-3 bg-gray-800 rounded-lg">
                          <div className="text-xs text-gray-500 mb-1">POP3</div>
                          <div className="text-white font-mono">pop3.nubo.email</div>
                          <div className="text-sm text-gray-400">Port: 995 (SSL/TLS)</div>
                        </div>
                        <div className="p-3 bg-gray-800 rounded-lg">
                          <div className="text-xs text-gray-500 mb-1">SMTP</div>
                          <div className="text-white font-mono">smtp.nubo.email</div>
                          <div className="text-sm text-gray-400">Port: 465 (SSL/TLS)</div>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="starttls" className="space-y-3 mt-4">
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="p-3 bg-gray-800 rounded-lg">
                          <div className="text-xs text-gray-500 mb-1">IMAP</div>
                          <div className="text-white font-mono">mail.nubo.email</div>
                          <div className="text-sm text-gray-400">Port: 143 (STARTTLS)</div>
                        </div>
                        <div className="p-3 bg-gray-800 rounded-lg">
                          <div className="text-xs text-gray-500 mb-1">POP3</div>
                          <div className="text-white font-mono">mail.nubo.email</div>
                          <div className="text-sm text-gray-400">Port: 110 (STARTTLS)</div>
                        </div>
                        <div className="p-3 bg-gray-800 rounded-lg">
                          <div className="text-xs text-gray-500 mb-1">SMTP</div>
                          <div className="text-white font-mono">mail.nubo.email</div>
                          <div className="text-sm text-gray-400">Port: 587 (STARTTLS)</div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </Card>

                {/* Skip Option */}
                <Card className="bg-gray-900 border-gray-800 p-6">
                  <div className="flex items-start space-x-3">
                    <Checkbox 
                      id="skipDomain"
                      checked={skipDomainSetup}
                      onCheckedChange={(checked) => setSkipDomainSetup(checked as boolean)}
                    />
                    <div>
                      <Label htmlFor="skipDomain" className="text-gray-300 cursor-pointer">
                        Skip domain setup for now
                      </Label>
                      <p className="text-sm text-gray-500 mt-1">
                        You can configure your domain later. DNS changes can take up to 48 hours to propagate.
                      </p>
                    </div>
                  </div>
                  
                  {!skipDomainSetup && (
                    <div className="mt-4">
                      {domainVerified ? (
                        <div className="flex items-center space-x-2 text-green-400">
                          <CheckCircle className="w-5 h-5" />
                          <span>DNS records are being verified - You can proceed to the next step</span>
                        </div>
                      ) : (
                        <Button
                          onClick={() => {
                            setDomainVerified(true);
                            toast({
                              title: "DNS Records Marked as Added",
                              description: "You can now proceed to the next step",
                            });
                          }}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          I've added the DNS records
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              </motion.div>
            )}

            {/* Step 4: Email Allocation */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Email Allocation</h2>
                  <p className="text-gray-400">Create email accounts and allocate storage</p>
                </div>

                {/* Storage Progress */}
                <Card className="bg-gray-900 border-gray-800 p-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-white">Storage Usage</h3>
                    <span className="text-sm text-gray-400">
                      {totalStorageUsed} MB / {getTotalStorageInMB()} MB
                    </span>
                  </div>
                  <Progress 
                    value={(totalStorageUsed / getTotalStorageInMB()) * 100} 
                    className="h-3 bg-gray-800"
                  />
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      {Math.round((totalStorageUsed / getTotalStorageInMB()) * 100)}% used
                    </span>
                    {totalStorageUsed >= getTotalStorageInMB() * 0.9 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // Move to the next storage tier
                          const plans = Object.keys(storagePlans);
                          const currentIndex = plans.indexOf(selectedPlan);
                          if (currentIndex < plans.length - 1) {
                            setSelectedPlan(plans[currentIndex + 1]);
                            toast({
                              title: "Storage Upgraded",
                              description: `Upgraded to ${plans[currentIndex + 1]} plan`,
                            });
                          }
                        }}
                        className="text-blue-400 border-blue-600 hover:bg-blue-600/20"
                      >
                        <HardDrive className="w-4 h-4 mr-2" />
                        Need More Storage?
                      </Button>
                    )}
                  </div>
                </Card>

                {/* Email Accounts */}
                <Card className="bg-gray-900 border-gray-800 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-white">Email Accounts</h3>
                    <Button
                      onClick={addEmailAccount}
                      disabled={totalStorageUsed >= getTotalStorageInMB()}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Add Email Account
                    </Button>
                  </div>

                  {emailAccounts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No email accounts added yet. Click "Add Email Account" to get started.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {emailAccounts.map((account, index) => (
                        <div key={index} className="p-4 bg-gray-800 rounded-lg">
                          <div className="grid md:grid-cols-2 gap-4 mb-3">
                            <div>
                              <Label className="text-gray-300">Email Address</Label>
                              <div className="flex">
                                <Input
                                  value={account.email}
                                  onChange={(e) => updateEmailAccount(index, 'email', e.target.value)}
                                  className="bg-gray-700 border-gray-600 text-white rounded-r-none"
                                  placeholder="username"
                                />
                                <div className="px-3 py-2 bg-gray-700 border border-l-0 border-gray-600 text-gray-400 rounded-r-md">
                                  @{businessDetails.domain}
                                </div>
                              </div>
                            </div>
                            
                            <div>
                              <Label className="text-gray-300">Allocated Storage (MB)</Label>
                              <Input
                                type="number"
                                min="10"
                                max={getTotalStorageInMB() - totalStorageUsed + account.allocatedStorage}
                                value={account.allocatedStorage}
                                onChange={(e) => updateEmailAccount(index, 'allocatedStorage', parseInt(e.target.value) || 0)}
                                className="bg-gray-700 border-gray-600 text-white"
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex space-x-4">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  checked={account.migration}
                                  onCheckedChange={(checked) => updateEmailAccount(index, 'migration', checked)}
                                />
                                <Label className="text-sm text-gray-400 cursor-pointer">
                                  Migration Required
                                </Label>
                              </div>
                              
                              {archivalPlan && (
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    checked={account.archival}
                                    onCheckedChange={(checked) => updateEmailAccount(index, 'archival', checked)}
                                  />
                                  <Label className="text-sm text-gray-400 cursor-pointer">
                                    Enable Archival
                                  </Label>
                                </div>
                              )}
                            </div>
                            
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeEmailAccount(index)}
                              className="text-red-400 hover:text-red-300"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Summary */}
                {emailAccounts.length > 0 && (
                  <Card className="bg-blue-950/30 border-blue-800/50 p-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Email Accounts:</span>
                        <span className="text-white">{emailAccounts.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Accounts with Migration:</span>
                        <span className="text-white">{emailAccounts.filter(a => a.migration).length}</span>
                      </div>
                      {archivalPlan && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Accounts with Archival:</span>
                          <span className="text-white">{emailAccounts.filter(a => a.archival).length}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-gray-700">
                        <span className="text-gray-400">Storage Allocated:</span>
                        <span className="text-white">{totalStorageUsed} MB / {getTotalStorageInMB()} MB</span>
                      </div>
                    </div>
                  </Card>
                )}
              </motion.div>
            )}

            {/* Step 5: Payment */}
            {currentStep === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Payment Information</h2>
                  <p className="text-gray-400">Complete your purchase to activate your account</p>
                </div>

                {/* Order Summary */}
                <Card className="bg-gray-900 border-gray-800 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Order Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Storage Plan ({selectedPlan})</span>
                      <span className="text-white">
                        ₹{storagePlans[selectedPlan as keyof typeof storagePlans][billingCycle === 'monthly' ? 'monthly' : 'annual']}
                      </span>
                    </div>
                    
                    {archivalPlan && archivalUsers > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">
                          Email Archival ({archivalUsers} users)
                        </span>
                        <span className="text-white">
                          ₹{archivalPlans[archivalPlan as keyof typeof archivalPlans].price * archivalUsers * (billingCycle === 'monthly' ? 1 : 12)}
                        </span>
                      </div>
                    )}
                    
                    <div className="pt-3 mt-3 border-t border-gray-700">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold text-white">Total Amount</span>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-white">
                            ₹{calculateTotalPrice().toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            per {billingCycle === 'monthly' ? 'month' : 'year'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Payment Method */}
                <Card className="bg-gray-900 border-gray-800 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Payment Method</h3>
                  
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
                        <Shield className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">Secure Payment via Razorpay</p>
                        <p className="text-sm text-gray-400">
                          You will be redirected to Razorpay's secure payment gateway
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge className="bg-gray-700 text-gray-300">Credit Card</Badge>
                      <Badge className="bg-gray-700 text-gray-300">Debit Card</Badge>
                      <Badge className="bg-gray-700 text-gray-300">UPI</Badge>
                      <Badge className="bg-gray-700 text-gray-300">Net Banking</Badge>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-600/10 border border-blue-600/30 rounded-lg">
                    <p className="text-sm text-blue-400">
                      💡 Test Mode: Use Razorpay test cards for payment
                    </p>
                  </div>
                </Card>

                {/* Terms */}
                <Card className="bg-gray-900 border-gray-800 p-6">
                  <div className="flex items-start space-x-3">
                    <Checkbox 
                      id="terms" 
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                    />
                    <Label htmlFor="terms" className="text-sm text-gray-400 cursor-pointer">
                      I agree to the Terms of Service and Privacy Policy. 
                      I understand that I will be charged ₹{calculateTotalPrice().toLocaleString()} 
                      {billingCycle === 'monthly' ? ' monthly' : ' annually'} until I cancel my subscription.
                    </Label>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1 || isLoading}
              className="border-gray-700 text-gray-300 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            
            {currentStep < 5 ? (
              <Button
                onClick={nextStep}
                disabled={isLoading}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <>
              <Button
                type="button"
                onClick={() => {
                  console.log('Button clicked directly');
                  completeOnboarding();
                }}
                disabled={isLoading || !termsAccepted}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Complete Purchase
                    <Check className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}