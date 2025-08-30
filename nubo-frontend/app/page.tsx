'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  Mail, Shield, Users, Globe, Check, Star, ArrowRight, 
  ChevronRight, Award, Building, IndianRupee, Zap, Lock,
  Database, Cloud, Phone, MessageCircle, Headphones,
  TrendingDown, Server, FileText, DollarSign, X, Calculator,
  Archive, HardDrive, Minus, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

// Google Workspace Pricing (per user per month)
const googlePricing = {
  starter: { name: 'Business Starter', price: 270 },
  standard: { name: 'Business Standard', price: 1080 },
  plus: { name: 'Business Plus', price: 1700 },
  enterprise: { name: 'Enterprise Plus', price: 2650 }
};

// Office 365 Pricing (per user per month)
const office365Pricing = {
  basic: { name: 'Business Basic', price: 174 },
  standard: { name: 'Business Standard', price: 924 },
  premium: { name: 'Business Premium', price: 2196 }
};

// Nubo Pricing (fixed price regardless of users)
const nuboPricing = {
  '5GB': { annual: 1999, monthly: 216 },
  '25GB': { annual: 6999, monthly: 759 },
  '100GB': { annual: 22999, monthly: 2491 },
  '500GB': { annual: 89999, monthly: 9750 },
  '1TB': { annual: 169999, monthly: 18416 }
};

export default function LandingPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState('unlimited');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('annually');
  
  // Cost Calculator State
  const [calcProvider, setCalcProvider] = useState<'google' | 'office365'>('google');
  const [calcPlan, setCalcPlan] = useState('standard');
  const [totalUsers, setTotalUsers] = useState(50);
  const [premiumUsers, setPremiumUsers] = useState(5);
  const [nuboStorage, setNuboStorage] = useState('100GB');

  // Calculate costs
  const costBreakdown = useMemo(() => {
    const nuboUsers = totalUsers - premiumUsers;
    
    // Premium provider cost
    let premiumMonthlyPerUser = 0;
    if (calcProvider === 'google') {
      premiumMonthlyPerUser = googlePricing[calcPlan as keyof typeof googlePricing].price;
    } else {
      premiumMonthlyPerUser = office365Pricing[calcPlan as keyof typeof office365Pricing].price;
    }
    
    const premiumMonthlyCost = premiumUsers * premiumMonthlyPerUser;
    const premiumAnnualCost = premiumMonthlyCost * 12;
    
    // Nubo cost (fixed, not per user)
    const nuboMonthlyCost = nuboPricing[nuboStorage as keyof typeof nuboPricing].monthly;
    const nuboAnnualCost = nuboPricing[nuboStorage as keyof typeof nuboPricing].annual;
    
    // Total hybrid cost
    const totalMonthlyCost = premiumMonthlyCost + nuboMonthlyCost;
    const totalAnnualCost = premiumAnnualCost + nuboAnnualCost;
    
    // All premium cost (if all users were on premium service)
    const allPremiumMonthlyCost = totalUsers * premiumMonthlyPerUser;
    const allPremiumAnnualCost = allPremiumMonthlyCost * 12;
    
    // Savings
    const monthlySavings = allPremiumMonthlyCost - totalMonthlyCost;
    const annualSavings = allPremiumAnnualCost - totalAnnualCost;
    const savingsPercentage = Math.round((annualSavings / allPremiumAnnualCost) * 100);
    
    return {
      premiumMonthlyCost,
      premiumAnnualCost,
      nuboMonthlyCost,
      nuboAnnualCost,
      nuboUsers,
      totalMonthlyCost,
      totalAnnualCost,
      allPremiumMonthlyCost,
      allPremiumAnnualCost,
      monthlySavings,
      annualSavings,
      savingsPercentage
    };
  }, [calcProvider, calcPlan, totalUsers, premiumUsers, nuboStorage]);

  // Pricing calculation with 30% increase for monthly
  const unlimitedPlans = [
    { 
      space: '5 GB', 
      priceAnnual: 1999,
      priceMonthly: Math.round(1999 / 12 * 1.3),
      popular: false 
    },
    { 
      space: '25 GB', 
      priceAnnual: 6999,
      priceMonthly: Math.round(6999 / 12 * 1.3),
      popular: true 
    },
    { 
      space: '100 GB', 
      priceAnnual: 22999,
      priceMonthly: Math.round(22999 / 12 * 1.3),
      popular: false 
    },
    { 
      space: '500 GB', 
      priceAnnual: 89999,
      priceMonthly: Math.round(89999 / 12 * 1.3),
      popular: false 
    },
  ];

  const perUserPlans = [
    { 
      space: '1 GB', 
      priceAnnual: 299,
      priceMonthly: Math.round(299 / 12 * 1.3),
      perUser: true 
    },
    { 
      space: '10 GB', 
      priceAnnual: 799,
      priceMonthly: Math.round(799 / 12 * 1.3),
      perUser: true 
    },
    { 
      space: '50 GB', 
      priceAnnual: 1499,
      priceMonthly: Math.round(1499 / 12 * 1.3),
      perUser: true 
    },
    { 
      space: '100 GB', 
      priceAnnual: 2499,
      priceMonthly: Math.round(2499 / 12 * 1.3),
      perUser: true 
    },
  ];

  const trustedCompanies = [
    { name: 'Vintrex Fintech', logo: '/uploads/ujjivan.png' },
    { name: 'Auisy Technologies', logo: '/uploads/jockey.png' },
    { name: 'Chandorkar Technologies', logo: '/uploads/kurlon.webp' },
    { name: 'Eastern Condiments', logo: '/uploads/eastern.png' },
    { name: 'Suryoday Bank', logo: '/uploads/Suryoday.jpg' }
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Navigation */}
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
            <div className="hidden md:flex items-center space-x-8">
              <Link href="#features" className="text-gray-300 hover:text-white transition-colors">Features</Link>
              <Link href="#calculator" className="text-gray-300 hover:text-white transition-colors">Cost Calculator</Link>
              <Link href="#pricing-model" className="text-gray-300 hover:text-white transition-colors">Pricing</Link>
              <Link href="#archival" className="text-gray-300 hover:text-white transition-colors">Archival</Link>
              <Link href="#clients" className="text-gray-300 hover:text-white transition-colors">Clients</Link>
              <Link href="/login" className="text-gray-300 hover:text-white transition-colors">Login</Link>
              <Button onClick={() => router.push('/onboarding')} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white border-0">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-32 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-cyan-600/20"></div>
        <div className="container mx-auto max-w-6xl relative">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            className="text-center"
          >
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-orange-600/20 to-orange-500/20 border border-orange-500/30 text-orange-400 rounded-full mb-6">
              <span className="text-sm font-semibold">🇮🇳 Made in India • Data Stored in India</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Save
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400"> 70-90%</span>
              <br />on Business Email
            </h1>
            
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              The economical, secure, and scalable alternative to GSuite & Office365. 
              <strong className="text-white"> Unlimited users</strong>, hybrid deployment options, and enterprise-grade compliance — 
              trusted by 1000s of Indian businesses.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-lg px-8 py-6 border-0"
                onClick={() => router.push('/onboarding')}
              >
                Start from ₹216/Month
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8 py-6 border-gray-700 text-white hover:bg-gray-800"
                onClick={() => document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Calculate Your Savings
              </Button>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center gap-8 items-center">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-green-400" />
                <span className="text-sm text-gray-400">Bank-Grade Security</span>
              </div>
              <div className="flex items-center space-x-2">
                <Award className="w-5 h-5 text-green-400" />
                <span className="text-sm text-gray-400">96% Retention Rate</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-green-400" />
                <span className="text-sm text-gray-400">1000+ Domains Hosted</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Hybrid Email Cost Calculator Section */}
      <section id="calculator" className="py-20 bg-gray-900">
        <div className="container mx-auto max-w-6xl px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <h2 className="text-4xl font-bold text-center mb-4 text-white">
              Hybrid Email <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Cost Calculator</span>
            </h2>
            <p className="text-xl text-gray-400 text-center mb-12 max-w-3xl mx-auto">
              Calculate exactly how much you can save by moving to a hybrid email setup
            </p>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Calculator Inputs */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-2xl p-8 border border-gray-700">
                <h3 className="text-2xl font-bold text-white mb-6">Configure Your Setup</h3>
                
                {/* Current Provider */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-300 mb-3">Current Email Provider</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setCalcProvider('google')}
                      className={`p-3 rounded-lg border transition-all ${
                        calcProvider === 'google' 
                          ? 'bg-blue-600/20 border-blue-500 text-white' 
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                      }`}
                    >
                      Google Workspace
                    </button>
                    <button
                      onClick={() => setCalcProvider('office365')}
                      className={`p-3 rounded-lg border transition-all ${
                        calcProvider === 'office365' 
                          ? 'bg-blue-600/20 border-blue-500 text-white' 
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                      }`}
                    >
                      Office 365
                    </button>
                  </div>
                </div>

                {/* Current Plan */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-300 mb-3">Current Plan</label>
                  <select 
                    value={calcPlan}
                    onChange={(e) => setCalcPlan(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  >
                    {calcProvider === 'google' ? (
                      <>
                        <option value="starter">Business Starter (₹270/user/month)</option>
                        <option value="standard">Business Standard (₹1,080/user/month)</option>
                        <option value="plus">Business Plus (₹1,700/user/month)</option>
                        <option value="enterprise">Enterprise Plus (₹2,650/user/month)</option>
                      </>
                    ) : (
                      <>
                        <option value="basic">Business Basic (₹174/user/month)</option>
                        <option value="standard">Business Standard (₹924/user/month)</option>
                        <option value="premium">Business Premium (₹2,196/user/month)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Total Users */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Total Email Users: <span className="text-blue-400">{totalUsers}</span>
                  </label>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setTotalUsers(Math.max(10, totalUsers - 10))}
                      className="p-2 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700"
                    >
                      <Minus className="w-4 h-4 text-white" />
                    </button>
                    <input 
                      type="range"
                      min="10"
                      max="500"
                      step="10"
                      value={totalUsers}
                      onChange={(e) => setTotalUsers(Number(e.target.value))}
                      className="flex-1"
                    />
                    <button
                      onClick={() => setTotalUsers(Math.min(500, totalUsers + 10))}
                      className="p-2 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700"
                    >
                      <Plus className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>

                {/* Premium Users */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Keep on Premium ({calcProvider === 'google' ? 'Google Workspace' : 'Office 365'}): <span className="text-blue-400">{premiumUsers}</span>
                  </label>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setPremiumUsers(Math.max(0, premiumUsers - 1))}
                      className="p-2 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700"
                    >
                      <Minus className="w-4 h-4 text-white" />
                    </button>
                    <input 
                      type="range"
                      min="0"
                      max={Math.min(50, totalUsers)}
                      value={premiumUsers}
                      onChange={(e) => setPremiumUsers(Number(e.target.value))}
                      className="flex-1"
                    />
                    <button
                      onClick={() => setPremiumUsers(Math.min(Math.min(50, totalUsers), premiumUsers + 1))}
                      className="p-2 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700"
                    >
                      <Plus className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Move to Nubo: <span className="text-green-400 font-semibold">{costBreakdown.nuboUsers} users</span>
                  </p>
                </div>

                {/* Nubo Storage */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-300 mb-3">Nubo Storage Plan</label>
                  <select 
                    value={nuboStorage}
                    onChange={(e) => setNuboStorage(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="5GB">5 GB (₹1,999/year)</option>
                    <option value="25GB">25 GB (₹6,999/year)</option>
                    <option value="100GB">100 GB (₹22,999/year)</option>
                    <option value="500GB">500 GB (₹89,999/year)</option>
                    <option value="1TB">1 TB (₹1,69,999/year)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    Supports unlimited users on Nubo
                  </p>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-2xl p-8 border border-gray-700">
                <h3 className="text-2xl font-bold text-white mb-6">Cost Breakdown</h3>
                
                {/* Hybrid Setup Cost */}
                <div className="mb-6 p-4 bg-gray-900 rounded-xl border border-gray-700">
                  <h4 className="text-lg font-semibold text-green-400 mb-4">Hybrid Setup (Recommended)</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">
                        {premiumUsers} {calcProvider === 'google' ? 'Google Workspace' : 'Office 365'} users
                      </span>
                      <span className="text-white font-semibold">₹{costBreakdown.premiumAnnualCost.toLocaleString()}/year</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">
                        {costBreakdown.nuboUsers} Nubo users ({nuboStorage})
                      </span>
                      <span className="text-white font-semibold">₹{costBreakdown.nuboAnnualCost.toLocaleString()}/year</span>
                    </div>
                    <div className="pt-3 mt-3 border-t border-gray-700 flex justify-between items-center">
                      <span className="text-lg font-semibold text-white">Total Cost</span>
                      <span className="text-lg font-bold text-green-400">₹{costBreakdown.totalAnnualCost.toLocaleString()}/year</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Monthly: ₹{costBreakdown.totalMonthlyCost.toLocaleString()}/month
                    </div>
                  </div>
                </div>

                {/* All Premium Cost */}
                <div className="mb-6 p-4 bg-gray-900 rounded-xl border border-gray-700">
                  <h4 className="text-lg font-semibold text-red-400 mb-4">All Premium Setup (Current)</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">
                        {totalUsers} {calcProvider === 'google' ? 'Google Workspace' : 'Office 365'} users
                      </span>
                      <span className="text-white font-semibold">₹{costBreakdown.allPremiumAnnualCost.toLocaleString()}/year</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Monthly: ₹{costBreakdown.allPremiumMonthlyCost.toLocaleString()}/month
                    </div>
                  </div>
                </div>

                {/* Savings */}
                <div className="p-6 bg-gradient-to-r from-green-600/20 to-emerald-600/20 rounded-xl border border-green-600/30">
                  <div className="text-center">
                    <p className="text-sm text-green-400 mb-2">Your Annual Savings</p>
                    <p className="text-4xl font-bold text-white mb-2">
                      ₹{costBreakdown.annualSavings.toLocaleString()}
                    </p>
                    <p className="text-lg text-green-400 font-semibold">
                      {costBreakdown.savingsPercentage}% Cost Reduction
                    </p>
                    <p className="text-sm text-gray-400 mt-3">
                      Monthly Savings: ₹{costBreakdown.monthlySavings.toLocaleString()}
                    </p>
                  </div>
                </div>

                <Button 
                  className="w-full mt-6 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white border-0"
                  size="lg"
                  onClick={() => router.push('/onboarding')}
                >
                  Start Saving Now
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Model Explanation */}
      <section id="pricing-model" className="py-20 bg-gray-950">
        <div className="container mx-auto max-w-6xl px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <h2 className="text-4xl font-bold text-center mb-4 text-white">
              Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Revolutionary</span> Pricing Model
            </h2>
            <p className="text-xl text-gray-400 text-center mb-12 max-w-3xl mx-auto">
              Pay for storage, not for mailboxes. Add unlimited users without extra cost.
            </p>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Traditional Pricing */}
              <div className="bg-gradient-to-br from-red-900/20 to-red-950/20 rounded-2xl p-8 border border-red-900/30">
                <div className="flex items-center mb-4">
                  <X className="w-8 h-8 text-red-500 mr-3" />
                  <h3 className="text-2xl font-bold text-white">Traditional Email Pricing</h3>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <X className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">Per user charges:</strong> ₹174-2,650 per user per month
                    </span>
                  </li>
                  <li className="flex items-start">
                    <X className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">Cost scales linearly:</strong> 100 users = 100x the cost
                    </span>
                  </li>
                  <li className="flex items-start">
                    <X className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">Unused storage wasted:</strong> Each user gets fixed storage
                    </span>
                  </li>
                  <li className="flex items-start">
                    <X className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">Expensive for large teams:</strong> Prohibitive for 50+ users
                    </span>
                  </li>
                </ul>
                <div className="mt-6 p-4 bg-red-900/20 rounded-lg border border-red-800/30">
                  <p className="text-red-400 text-center font-semibold">
                    100 users on Google Workspace Standard = ₹12,96,000/year
                  </p>
                </div>
              </div>

              {/* Nubo Pricing */}
              <div className="bg-gradient-to-br from-green-900/20 to-green-950/20 rounded-2xl p-8 border border-green-900/30">
                <div className="flex items-center mb-4">
                  <Check className="w-8 h-8 text-green-500 mr-3" />
                  <h3 className="text-2xl font-bold text-white">Nubo Storage-Based Pricing</h3>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">Pay for storage only:</strong> ₹1,999-89,999 total per year
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">Unlimited users:</strong> Add 10 or 1000 users, same price
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">Shared storage pool:</strong> Efficient usage across team
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">Scalable for growth:</strong> Perfect for growing businesses
                    </span>
                  </li>
                </ul>
                <div className="mt-6 p-4 bg-green-900/20 rounded-lg border border-green-800/30">
                  <p className="text-green-400 text-center font-semibold">
                    100 users on Nubo (100GB plan) = ₹22,999/year
                  </p>
                </div>
              </div>
            </div>

            {/* Visual Comparison */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-2xl p-8 border border-gray-700">
              <h4 className="text-xl font-bold text-white mb-6 text-center">Cost Comparison for Different Team Sizes</h4>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400">Team Size</th>
                      <th className="text-right py-3 px-4 text-gray-400">Google Workspace</th>
                      <th className="text-right py-3 px-4 text-gray-400">Office 365</th>
                      <th className="text-right py-3 px-4 text-green-400">Nubo (100GB)</th>
                      <th className="text-right py-3 px-4 text-blue-400">Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[10, 25, 50, 100, 200].map((size) => (
                      <tr key={size} className="border-b border-gray-800">
                        <td className="py-3 px-4 text-white font-semibold">{size} users</td>
                        <td className="text-right py-3 px-4 text-gray-300">₹{(size * 1080 * 12).toLocaleString()}</td>
                        <td className="text-right py-3 px-4 text-gray-300">₹{(size * 924 * 12).toLocaleString()}</td>
                        <td className="text-right py-3 px-4 text-green-400 font-semibold">₹22,999</td>
                        <td className="text-right py-3 px-4 text-blue-400 font-bold">
                          {Math.round(((size * 924 * 12 - 22999) / (size * 924 * 12)) * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Email Archival Service */}
      <section id="archival" className="py-20 bg-gray-900">
        <div className="container mx-auto max-w-6xl px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <h2 className="text-4xl font-bold text-center mb-4 text-white">
              Email <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Archival Service</span>
            </h2>
            <p className="text-xl text-gray-400 text-center mb-12 max-w-3xl mx-auto">
              Never lose an email again. Comprehensive archival for compliance, backup, and peace of mind.
            </p>

            <div className="grid lg:grid-cols-2 gap-8 mb-12">
              {/* Archival Features */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-2xl p-8 border border-gray-700">
                <div className="flex items-center mb-6">
                  <Archive className="w-10 h-10 text-purple-500 mr-4" />
                  <h3 className="text-2xl font-bold text-white">Complete Email Archival</h3>
                </div>
                
                <ul className="space-y-4 mb-6">
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">Automatic Archival:</strong> All incoming and outgoing emails archived automatically
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">Unlimited Retention:</strong> Keep emails for years without storage limits
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">Instant Search:</strong> Find any email in seconds with advanced search
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">Legal Hold:</strong> Preserve emails for litigation and compliance
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">Tamper-Proof:</strong> Immutable storage ensures email integrity
                    </span>
                  </li>
                </ul>

                <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-700/30">
                  <p className="text-purple-400 font-semibold text-center">
                    Starting at just ₹49/user/month
                  </p>
                </div>
              </div>

              {/* Use Cases */}
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl p-6 border border-gray-700">
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <Users className="w-5 h-5 text-blue-400 mr-2" />
                    Employee Departure
                  </h4>
                  <p className="text-gray-300">
                    When employees leave, their email history remains accessible. Transfer knowledge seamlessly without losing critical communications.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl p-6 border border-gray-700">
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <Shield className="w-5 h-5 text-green-400 mr-2" />
                    Accidental Deletion
                  </h4>
                  <p className="text-gray-300">
                    Accidentally deleted important emails? Retrieve them instantly from the archive. No more panic over lost communications.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl p-6 border border-gray-700">
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <FileText className="w-5 h-5 text-yellow-400 mr-2" />
                    Regulatory Compliance
                  </h4>
                  <p className="text-gray-300">
                    Meet industry regulations and audit requirements. Maintain complete email records for RBI, SEBI, and other regulatory bodies.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl p-6 border border-gray-700">
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <Database className="w-5 h-5 text-purple-400 mr-2" />
                    Business Continuity
                  </h4>
                  <p className="text-gray-300">
                    Ensure business continuity with complete email backup. Recover from disasters quickly with all historical communications intact.
                  </p>
                </div>
              </div>
            </div>

            {/* Archival Pricing */}
            <div className="bg-gradient-to-r from-purple-600/10 to-pink-600/10 rounded-2xl p-8 border border-purple-600/30">
              <div className="text-center">
                <h4 className="text-2xl font-bold text-white mb-4">Simple Archival Pricing</h4>
                <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                  <div className="bg-gray-800/50 rounded-xl p-6">
                    <h5 className="text-lg font-semibold text-white mb-2">Basic</h5>
                    <p className="text-3xl font-bold text-purple-400 mb-2">₹49</p>
                    <p className="text-gray-400 text-sm">per user/month</p>
                    <p className="text-gray-300 mt-3">1 year retention</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-6 transform scale-105 border-2 border-purple-500">
                    <div className="bg-purple-500 text-white text-xs font-semibold px-2 py-1 rounded-full inline-block mb-2">POPULAR</div>
                    <h5 className="text-lg font-semibold text-white mb-2">Professional</h5>
                    <p className="text-3xl font-bold text-purple-400 mb-2">₹99</p>
                    <p className="text-gray-400 text-sm">per user/month</p>
                    <p className="text-gray-300 mt-3">3 years retention</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-6">
                    <h5 className="text-lg font-semibold text-white mb-2">Enterprise</h5>
                    <p className="text-3xl font-bold text-purple-400 mb-2">₹199</p>
                    <p className="text-gray-400 text-sm">per user/month</p>
                    <p className="text-gray-300 mt-3">Unlimited retention</p>
                  </div>
                </div>
                <Button 
                  className="mt-8 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0"
                  size="lg"
                  onClick={() => router.push('/welcome?service=archival')}
                >
                  Add Archival Service
                  <Archive className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-gray-950">
        <div className="container mx-auto max-w-6xl px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <h2 className="text-4xl font-bold text-center mb-4 text-white">
              Enterprise Features at SME Prices
            </h2>
            <p className="text-xl text-gray-400 text-center mb-12">
              Everything you need to run professional email, nothing you don't
            </p>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl p-6 border border-gray-700 hover:border-blue-600/50 transition-all">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center mb-4">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">Unlimited Users</h3>
                <p className="text-gray-400">
                  Add unlimited email accounts without per-user charges. Perfect for growing teams.
                </p>
              </div>

              <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl p-6 border border-gray-700 hover:border-green-600/50 transition-all">
                <div className="w-14 h-14 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center mb-4">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">Bank-Grade Security</h3>
                <p className="text-gray-400">
                  Pass regulatory audits with enterprise security, spam filtering, and access controls.
                </p>
              </div>

              <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl p-6 border border-gray-700 hover:border-purple-600/50 transition-all">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center mb-4">
                  <Zap className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">Hybrid Deployment</h3>
                <p className="text-gray-400">
                  Keep critical emails on GSuite/O365 while moving others to Nubo. Best of both worlds.
                </p>
              </div>

              <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl p-6 border border-gray-700 hover:border-orange-600/50 transition-all">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-600 to-red-600 rounded-xl flex items-center justify-center mb-4">
                  <Server className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">Made in India</h3>
                <p className="text-gray-400">
                  Your data stays in India. Compliant with local regulations and data sovereignty laws.
                </p>
              </div>

              <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl p-6 border border-gray-700 hover:border-red-600/50 transition-all">
                <div className="w-14 h-14 bg-gradient-to-br from-red-600 to-rose-600 rounded-xl flex items-center justify-center mb-4">
                  <HardDrive className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">Pooled Storage</h3>
                <p className="text-gray-400">
                  Efficient storage sharing across your team. No wasted space on inactive accounts.
                </p>
              </div>

              <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl p-6 border border-gray-700 hover:border-indigo-600/50 transition-all">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center mb-4">
                  <Headphones className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">24/7 Support</h3>
                <p className="text-gray-400">
                  Phone, chat, and email support. No partner liability - we handle everything directly.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Plans */}
      <section id="pricing" className="py-20 bg-gray-900">
        <div className="container mx-auto max-w-6xl px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <h2 className="text-4xl font-bold text-center mb-4 text-white">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-400 text-center mb-8">
              No hidden fees. No per-user charges. Just honest pricing.
            </p>

            {/* Billing Toggle */}
            <div className="flex justify-center mb-8">
              <div className="bg-gray-800 rounded-full p-1 inline-flex">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                    billingCycle === 'monthly' 
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('annually')}
                  className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                    billingCycle === 'annually' 
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Annually <span className="text-green-400 ml-1">(Save 30%)</span>
                </button>
              </div>
            </div>

            {/* Plan Toggle */}
            <div className="flex justify-center mb-12">
              <div className="bg-gray-800 rounded-lg p-1 shadow-xl inline-flex">
                <button
                  onClick={() => setSelectedPlan('unlimited')}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    selectedPlan === 'unlimited' 
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Unlimited Users (Recommended)
                </button>
                <button
                  onClick={() => setSelectedPlan('peruser')}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    selectedPlan === 'peruser' 
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Per User Plans
                </button>
              </div>
            </div>

            {/* Pricing Cards */}
            <div className="grid md:grid-cols-4 gap-6">
              {(selectedPlan === 'unlimited' ? unlimitedPlans : perUserPlans).map((plan, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl overflow-hidden border ${
                    plan.popular ? 'border-blue-500 transform scale-105 shadow-2xl shadow-blue-600/20' : 'border-gray-700'
                  }`}
                >
                  {plan.popular && (
                    <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-center py-2 text-sm font-semibold">
                      MOST POPULAR
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="text-2xl font-bold mb-2 text-white">{plan.space}</h3>
                    <div className="mb-1">
                      <span className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                        ₹{billingCycle === 'monthly' ? plan.priceMonthly.toLocaleString() : plan.priceAnnual.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-400 mb-6">
                      {plan.perUser ? `per user/${billingCycle === 'monthly' ? 'month' : 'year'}` : `per ${billingCycle === 'monthly' ? 'month' : 'year'}`}
                    </p>
                    {billingCycle === 'monthly' && (
                      <p className="text-sm text-green-400 mb-4">
                        Save 30% with annual billing
                      </p>
                    )}
                    <ul className="space-y-3 mb-6">
                      <li className="flex items-start">
                        <Check className="w-5 h-5 text-green-400 mr-2 flex-shrink-0" />
                        <span className="text-sm text-gray-300">
                          {selectedPlan === 'unlimited' ? 'Unlimited email accounts' : 'Pooled storage'}
                        </span>
                      </li>
                      <li className="flex items-start">
                        <Check className="w-5 h-5 text-green-400 mr-2 flex-shrink-0" />
                        <span className="text-sm text-gray-300">Multiple domains</span>
                      </li>
                      <li className="flex items-start">
                        <Check className="w-5 h-5 text-green-400 mr-2 flex-shrink-0" />
                        <span className="text-sm text-gray-300">24/7 support</span>
                      </li>
                      <li className="flex items-start">
                        <Check className="w-5 h-5 text-green-400 mr-2 flex-shrink-0" />
                        <span className="text-sm text-gray-300">99.9% uptime SLA</span>
                      </li>
                    </ul>
                    <Button 
                      className={`w-full ${plan.popular ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white border-0' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                      onClick={() => router.push(`/welcome?plan=${plan.space.toLowerCase().replace(' ', '')}`)}
                    >
                      Get Started
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Free Personal Email */}
            <div className="mt-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 text-white relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20"></div>
              <div className="max-w-3xl mx-auto text-center relative">
                <h3 className="text-2xl font-bold mb-4">
                  Free @nubo.email for Personal Use!
                </h3>
                <p className="text-lg mb-6 text-blue-100">
                  Get your professional email address with 5GB storage absolutely FREE. 
                  Perfect for individuals and freelancers.
                </p>
                <Button 
                  size="lg" 
                  className="bg-white text-blue-600 hover:bg-gray-100"
                  onClick={() => router.push('/welcome?plan=free')}
                >
                  Claim Your Free Email
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social Proof */}
      <section id="clients" className="py-20 bg-gray-950">
        <div className="container mx-auto max-w-6xl px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <h2 className="text-4xl font-bold text-center mb-4 text-white">
              Trusted by Leading Indian Businesses
            </h2>
            <p className="text-xl text-gray-400 text-center mb-12">
              Join companies that have already cut their email costs
            </p>

            {/* Client Logos */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 items-center mb-16">
              {trustedCompanies.map((company, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gray-800/50 rounded-xl p-6 flex flex-col items-center justify-center hover:bg-gray-800 transition-all border border-gray-700"
                >
                  <div className="h-16 flex items-center justify-center mb-2">
                    <Image 
                      src={company.logo} 
                      alt={company.name}
                      width={80}
                      height={40}
                      className="object-contain filter brightness-90 hover:brightness-110 transition-all"
                    />
                  </div>
                  <p className="text-sm text-gray-400 text-center">{company.name}</p>
                </motion.div>
              ))}
            </div>

            {/* Testimonials */}
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl p-6 border border-gray-700">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-500 fill-current" />
                  ))}
                </div>
                <p className="text-gray-300 mb-4">
                  "Switched from GSuite and saved ₹8 lakhs annually. The hybrid setup lets us keep critical emails on GSuite while saving costs on others."
                </p>
                <div className="flex items-center space-x-3">
                  <Image 
                    src="/uploads/ujjivan.png" 
                    alt="Vintrex Fintech"
                    width={40}
                    height={40}
                    className="rounded-lg"
                  />
                  <div>
                    <div className="font-semibold text-white">Vintrex Fintech</div>
                    <div className="text-sm text-gray-500">500+ employees</div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl p-6 border border-gray-700">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-500 fill-current" />
                  ))}
                </div>
                <p className="text-gray-300 mb-4">
                  "Bank audit compliant, secure, and 70% cheaper than our previous solution. Support team is always available when needed."
                </p>
                <div className="flex items-center space-x-3">
                  <Image 
                    src="/uploads/jockey.png" 
                    alt="Auisy Technologies"
                    width={40}
                    height={40}
                    className="rounded-lg"
                  />
                  <div>
                    <div className="font-semibold text-white">Auisy Technologies</div>
                    <div className="text-sm text-gray-500">200+ employees</div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl p-6 border border-gray-700">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-500 fill-current" />
                  ))}
                </div>
                <p className="text-gray-300 mb-4">
                  "Perfect solution for our growing team. Client data stays in India, access controls work great, and unlimited staff addition."
                </p>
                <div className="flex items-center space-x-3">
                  <Image 
                    src="/uploads/kurlon.webp" 
                    alt="Chandorkar Technologies"
                    width={40}
                    height={40}
                    className="rounded-lg"
                  />
                  <div>
                    <div className="font-semibold text-white">Chandorkar Technologies</div>
                    <div className="text-sm text-gray-500">50+ employees</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-cyan-600">
        <div className="container mx-auto max-w-4xl px-4 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="text-white"
          >
            <h2 className="text-4xl font-bold mb-4">
              Stop Overpaying for Email
            </h2>
            <p className="text-xl mb-8 text-blue-100">
              Join 1000+ businesses saving lakhs on email every year
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-6"
                onClick={() => router.push('/onboarding')}
              >
                Start 30-Day Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="bg-transparent text-white border-white hover:bg-white hover:text-blue-600 text-lg px-8 py-6"
                onClick={() => window.open('tel:+919876543210', '_self')}
              >
                Book a Demo
                <Phone className="ml-2 w-5 h-5" />
              </Button>
            </div>

            <p className="mt-6 text-blue-100">
              No credit card required • Setup in 5 minutes • Cancel anytime
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 text-gray-300 py-12">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <Image 
                  src="/uploads/logo.png" 
                  alt="Nubo Logo" 
                  width={32} 
                  height={32}
                  className="rounded-lg"
                />
                <span className="text-xl font-bold text-white">Nubo.email</span>
              </div>
              <p className="text-sm">
                India's most affordable business email solution. 
                Made in India, for India.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="#archival" className="hover:text-white transition-colors">Email Archival</Link></li>
                <li><Link href="#calculator" className="hover:text-white transition-colors">Cost Calculator</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><Link href="/support" className="hover:text-white transition-colors">Support</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <Phone className="w-4 h-4 mr-2" />
                  +91 98765 43210
                </li>
                <li className="flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  sales@nubo.email
                </li>
                <li className="flex items-center">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Live Chat Support
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>© 2024 Chandorkar Technologies. All rights reserved.</p>
            <p className="mt-2">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              {' • '}
              <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              {' • '}
              <Link href="/refund" className="hover:text-white transition-colors">Refund Policy</Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}