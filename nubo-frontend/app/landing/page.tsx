'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  Mail, Shield, Users, Globe, Check, Star, ArrowRight, 
  ChevronRight, Award, Building, IndianRupee, Zap, Lock,
  Database, Cloud, Phone, MessageCircle, Headphones,
  TrendingDown, Server, FileText, DollarSign, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export default function LandingPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState('unlimited');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('annually');

  // Pricing calculation with 30% increase for monthly
  const unlimitedPlans = [
    { 
      space: '5 GB', 
      priceAnnual: 1999, // Rounded from 1820
      priceMonthly: Math.round(1999 / 12 * 1.3), // 216 per month
      popular: false 
    },
    { 
      space: '25 GB', 
      priceAnnual: 6999, // Rounded from 6370
      priceMonthly: Math.round(6999 / 12 * 1.3), // 759 per month
      popular: true 
    },
    { 
      space: '100 GB', 
      priceAnnual: 22999, // Rounded from 21190
      priceMonthly: Math.round(22999 / 12 * 1.3), // 2491 per month
      popular: false 
    },
    { 
      space: '500 GB', 
      priceAnnual: 89999, // Rounded from 83200
      priceMonthly: Math.round(89999 / 12 * 1.3), // 9750 per month
      popular: false 
    },
  ];

  const perUserPlans = [
    { 
      space: '1 GB', 
      priceAnnual: 299, // Rounded from 247
      priceMonthly: Math.round(299 / 12 * 1.3), // 32 per month
      perUser: true 
    },
    { 
      space: '10 GB', 
      priceAnnual: 799, // Rounded from 676
      priceMonthly: Math.round(799 / 12 * 1.3), // 87 per month
      perUser: true 
    },
    { 
      space: '50 GB', 
      priceAnnual: 1499, // Rounded from 1235
      priceMonthly: Math.round(1499 / 12 * 1.3), // 162 per month
      perUser: true 
    },
    { 
      space: '100 GB', 
      priceAnnual: 2499, // Rounded from 2054
      priceMonthly: Math.round(2499 / 12 * 1.3), // 271 per month
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
              <Link href="#pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</Link>
              <Link href="#hybrid" className="text-gray-300 hover:text-white transition-colors">Hybrid Email</Link>
              <Link href="#clients" className="text-gray-300 hover:text-white transition-colors">Clients</Link>
              <Link href="/login" className="text-gray-300 hover:text-white transition-colors">Login</Link>
              <Button onClick={() => router.push('/signup')} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white border-0">
                Get Started Free
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
                onClick={() => router.push('/signup')}
              >
                Start from ₹216/Month
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8 py-6 border-gray-700 text-white hover:bg-gray-800"
                onClick={() => document.getElementById('pricing')?.scrollIntoView()}
              >
                View All Plans
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

      {/* Hybrid Email Explanation Section */}
      <section id="hybrid" className="py-20 bg-gray-900">
        <div className="container mx-auto max-w-6xl px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <h2 className="text-4xl font-bold text-center mb-4 text-white">
              What is <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Hybrid Email?</span>
            </h2>
            <p className="text-xl text-gray-400 text-center mb-12 max-w-3xl mx-auto">
              The smart way to optimize costs while maintaining flexibility
            </p>

            <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-2xl p-8 border border-gray-700">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-4">
                    Keep Critical Emails Premium, Move Others to Nubo
                  </h3>
                  <p className="text-gray-300 mb-6">
                    Hybrid email deployment allows you to maintain some email accounts on premium services 
                    like GSuite/Workspace or Office 365 for key executives or client-facing teams, while 
                    hosting the majority of your email accounts on Nubo's cost-effective platform.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-1" />
                      <span className="text-gray-300">
                        <strong className="text-white">Executive Accounts:</strong> Keep CEO, CFO on GSuite/O365
                      </span>
                    </li>
                    <li className="flex items-start">
                      <Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-1" />
                      <span className="text-gray-300">
                        <strong className="text-white">Team Accounts:</strong> Move operations, support, HR to Nubo
                      </span>
                    </li>
                    <li className="flex items-start">
                      <Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-1" />
                      <span className="text-gray-300">
                        <strong className="text-white">Seamless Integration:</strong> All emails work together perfectly
                      </span>
                    </li>
                    <li className="flex items-start">
                      <Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-1" />
                      <span className="text-gray-300">
                        <strong className="text-white">Massive Savings:</strong> Reduce overall email costs by 70-90%
                      </span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
                  <h4 className="text-lg font-semibold text-white mb-4">Example Cost Breakdown</h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-gray-700">
                      <span className="text-gray-400">5 Premium accounts (GSuite)</span>
                      <span className="text-white font-semibold">₹6,840/year</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-gray-700">
                      <span className="text-gray-400">95 Nubo accounts (100GB plan)</span>
                      <span className="text-white font-semibold">₹22,999/year</span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-lg font-semibold text-white">Total (100 users)</span>
                      <span className="text-lg font-bold text-green-400">₹29,839/year</span>
                    </div>
                    <div className="mt-4 p-3 bg-green-900/20 rounded-lg border border-green-700/30">
                      <p className="text-green-400 text-center font-semibold">
                        You Save ₹1,07,001 vs all GSuite accounts!
                      </p>
                    </div>
                  </div>
                </div>
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
                  <Database className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">Email Archival</h3>
                <p className="text-gray-400">
                  Store years of emails securely. Retrieve old emails instantly for audits and compliance.
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

      {/* Pricing */}
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
                      onClick={() => router.push(`/signup?plan=${plan.space.toLowerCase().replace(' ', '')}`)}
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
                  onClick={() => router.push('/signup?plan=free')}
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
                onClick={() => router.push('/signup')}
              >
                Start 30-Day Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="bg-transparent text-white border-white hover:bg-white hover:text-blue-600 text-lg px-8 py-6"
                onClick={() => router.push('/demo')}
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
                <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/security" className="hover:text-white transition-colors">Security</Link></li>
                <li><Link href="/compliance" className="hover:text-white transition-colors">Compliance</Link></li>
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