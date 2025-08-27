'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { 
  Mail, ArrowRight, Shield, Zap, Globe, Check, Star,
  Users, Lock, Smartphone, Cloud, Code, Heart,
  ChevronRight, Sparkles, Layers, RefreshCw, 
  Search, Archive, Send, Clock, AlertCircle, Trash2, Inbox
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const stats = [
  { label: 'Active Users', value: '10K+', growth: '+15%' },
  { label: 'Emails Processed', value: '5M+', growth: '+25%' },
  { label: 'Uptime', value: '99.9%', growth: 'SLA' },
  { label: 'Response Time', value: '<100ms', growth: 'Average' }
];

const features = [
  {
    icon: <Globe className="w-6 h-6" />,
    title: 'Multi-Account Support',
    description: 'Connect Gmail, Outlook, Yahoo, and any IMAP/SMTP email provider in one unified inbox.'
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Lightning Performance',
    description: 'Redis caching and optimized queries deliver sub-second load times for thousands of emails.'
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Enterprise Security',
    description: '2FA authentication, encrypted storage, and complete data ownership with self-hosting.'
  },
  {
    icon: <Smartphone className="w-6 h-6" />,
    title: 'Mobile Responsive',
    description: 'Progressive Web App with offline support, push notifications, and native-like experience.'
  },
  {
    icon: <Search className="w-6 h-6" />,
    title: 'Advanced Search',
    description: 'Full-text search across all accounts with filters, labels, and smart suggestions.'
  },
  {
    icon: <Code className="w-6 h-6" />,
    title: 'Open Source',
    description: 'We have AGPLv3 license, community-driven development with transparent roadmap and contributions.'
  }
];

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Product Manager',
    company: 'TechCorp',
    image: '/api/placeholder/48/48',
    content: 'Nubo has completely transformed how I manage multiple work and personal email accounts. The unified inbox is a game-changer!',
    rating: 5
  },
  {
    name: 'Mike Johnson',
    role: 'Developer',
    company: 'StartupXYZ',
    image: '/api/placeholder/48/48',
    content: 'As someone who values privacy, being able to self-host my email client while getting Gmail-like features is perfect.',
    rating: 5
  },
  {
    name: 'Emily Rodriguez',
    role: 'Designer',
    company: 'Creative Studio',
    image: '/api/placeholder/48/48',
    content: 'The UI is absolutely beautiful and the dark mode is perfectly implemented. It\'s a joy to use every day.',
    rating: 5
  }
];

const pricingPlans = [
  {
    name: 'Personal',
    price: 'Free',
    description: 'Perfect for individual use',
    features: [
      'Up to 3 email accounts',
      'Basic search and filters',
      'Dark/Light themes',
      'Mobile responsive',
      'Community support'
    ],
    cta: 'Start Free',
    popular: false
  },
  {
    name: 'Pro',
    price: '$9',
    period: '/month',
    description: 'For power users',
    features: [
      'Unlimited email accounts',
      'Advanced search & AI filters',
      'Custom themes & branding',
      'Priority sync & caching',
      'Email templates',
      'Priority support'
    ],
    cta: 'Start Trial',
    popular: true
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For organizations',
    features: [
      'Everything in Pro',
      'SSO & LDAP integration',
      'Audit logs & compliance',
      'Dedicated infrastructure',
      'Custom integrations',
      '24/7 phone support'
    ],
    cta: 'Contact Sales',
    popular: false
  }
];

export default function Home() {
  const router = useRouter();
  const [emailCount, setEmailCount] = useState(0);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    // Check both localStorage and sessionStorage for token
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      router.push('/inbox');
    }
  }, [router]);

  useEffect(() => {
    // Animate email counter
    const interval = setInterval(() => {
      setEmailCount(prev => {
        if (prev >= 5000000) return 0;
        return prev + Math.floor(Math.random() * 1000);
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Rotate features
    const interval = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % features.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900">
      {/* Header */}
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src="/logo.png" alt="Nubo" className="w-10 h-10 rounded-xl" />
            <span className="text-xl font-bold">Nubo</span>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
          </nav>
          <div className="flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-6"
          >
            <div className="inline-flex items-center space-x-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              <span>Now with AI-powered smart filters</span>
            </div>
            
            <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-neutral-900 via-neutral-700 to-neutral-600 dark:from-neutral-100 dark:via-neutral-300 dark:to-neutral-400 bg-clip-text text-transparent">
              All your inboxes,<br />one beautiful place.
            </h1>
            
            <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-3xl mx-auto">
              The open-source email client that respects your privacy. Connect unlimited email accounts, 
              enjoy lightning-fast performance, and take control of your communication.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
              <Link href="/signup">
                <Button size="lg" className="px-8 py-6 text-lg">
                  Get Started <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <a href="http://github.com/koolninad/nubo.email/" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="px-8 py-6 text-lg">
                  <Code className="w-5 h-5 mr-2" /> View source
                </Button>
              </a>
            </div>

            <div className="pt-8 flex items-center justify-center space-x-8 text-sm text-neutral-500">
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </motion.div>
        </section>


        {/* Interactive Demo */}
        <section className="max-w-7xl mx-auto px-6 py-24">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 overflow-hidden"
          >
            <div className="p-8 md:p-12">
              <h2 className="text-3xl font-bold mb-4">See it in action</h2>
              <p className="text-neutral-600 dark:text-neutral-400 mb-8">
                Experience the power of Nubo with our interactive demo
              </p>
              
              <div className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-sm text-neutral-500">inbox.nubo.email</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {emailCount.toLocaleString()} emails processed
                  </div>
                </div>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-neutral-900 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Inbox className="w-5 h-5 text-blue-500" />
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full">23 new</span>
                    </div>
                    <div className="space-y-2">
                      {[1,2,3].map(i => (
                        <div key={i} className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse"></div>
                          <div className="flex-1">
                            <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse mb-1"></div>
                            <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse w-3/4"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-neutral-900 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Send className="w-5 h-5 text-green-500" />
                      <span className="text-xs text-neutral-500">Compose</span>
                    </div>
                    <div className="space-y-2">
                      <div className="h-8 bg-neutral-100 dark:bg-neutral-800 rounded"></div>
                      <div className="h-8 bg-neutral-100 dark:bg-neutral-800 rounded"></div>
                      <div className="h-20 bg-neutral-100 dark:bg-neutral-800 rounded"></div>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-neutral-900 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Archive className="w-5 h-5 text-purple-500" />
                      <span className="text-xs text-neutral-500">Quick Actions</span>
                    </div>
                    <div className="space-y-2">
                      <Button size="sm" variant="outline" className="w-full justify-start">
                        <Clock className="w-4 h-4 mr-2" /> Snooze
                      </Button>
                      <Button size="sm" variant="outline" className="w-full justify-start">
                        <AlertCircle className="w-4 h-4 mr-2" /> Mark as Spam
                      </Button>
                      <Button size="sm" variant="outline" className="w-full justify-start">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features Grid */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-24">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Everything you need, nothing you don't</h2>
              <p className="text-xl text-neutral-600 dark:text-neutral-400">
                Powerful features designed for modern email workflows
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={`bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-xl transition-shadow ${
                    activeFeature === index ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onMouseEnter={() => setActiveFeature(index)}
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-xl flex items-center justify-center mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>



        {/* CTA Section */}
        <section className="max-w-7xl mx-auto px-6 py-24">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 text-center text-white"
          >
            <h2 className="text-4xl font-bold mb-4">
              Ready to revolutionize your email?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Become an early adopter
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="bg-white text-blue-600 hover:bg-neutral-100 px-8">
                  Get Started <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8">
                Schedule a demo
              </Button>
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              © 2025 Nubo. All rights reserved.
            </div>
            <div className="flex items-center space-x-6 text-sm text-neutral-600 dark:text-neutral-400">
              <span>Made with <Heart className="inline w-4 h-4 text-red-500" /> from India by the community</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}