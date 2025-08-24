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
    description: 'MIT licensed, community-driven development with transparent roadmap and contributions.'
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
            <a href="#features" className="text-sm hover:text-neutral-900 dark:hover:text-neutral-100">Features</a>
            <a href="#pricing" className="text-sm hover:text-neutral-900 dark:hover:text-neutral-100">Pricing</a>
            <a href="#testimonials" className="text-sm hover:text-neutral-900 dark:hover:text-neutral-100">Testimonials</a>
            <a href="https://docs.nubo.email" className="text-sm hover:text-neutral-900 dark:hover:text-neutral-100">Docs</a>
          </nav>
          <div className="flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button>Get started free</Button>
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
                  Start free trial <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <a href="https://github.com/nubo-email/nubo" target="_blank" rel="noopener noreferrer">
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

        {/* Live Stats */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            {stats.map((stat, index) => (
              <div key={index} className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800">
                <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                  {stat.value}
                </div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                  {stat.label}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-2">
                  {stat.growth}
                </div>
              </div>
            ))}
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

        {/* Pricing */}
        <section id="pricing" className="max-w-7xl mx-auto px-6 py-24">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Simple, transparent pricing</h2>
              <p className="text-xl text-neutral-600 dark:text-neutral-400">
                Start free and scale as you grow
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {pricingPlans.map((plan, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={`bg-white dark:bg-neutral-900 rounded-2xl p-8 border ${
                    plan.popular 
                      ? 'border-blue-500 shadow-xl scale-105' 
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  {plan.popular && (
                    <div className="bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full inline-block mb-4">
                      MOST POPULAR
                    </div>
                  )}
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-neutral-600 dark:text-neutral-400">{plan.period}</span>}
                  </div>
                  <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                    {plan.description}
                  </p>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start">
                        <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full" 
                    variant={plan.popular ? 'default' : 'outline'}
                    size="lg"
                  >
                    {plan.cta} <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="max-w-7xl mx-auto px-6 py-24">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Loved by thousands of users</h2>
              <p className="text-xl text-neutral-600 dark:text-neutral-400">
                See what our community has to say
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800"
                >
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                    "{testimonial.content}"
                  </p>
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full mr-4"></div>
                    <div>
                      <div className="font-semibold">{testimonial.name}</div>
                      <div className="text-sm text-neutral-500">
                        {testimonial.role} at {testimonial.company}
                      </div>
                    </div>
                  </div>
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
              Join thousands of users who've already made the switch
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="bg-white text-blue-600 hover:bg-neutral-100 px-8">
                  Start your free trial <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8">
                Schedule a demo
              </Button>
            </div>
            <div className="mt-8 flex items-center justify-center space-x-6 text-sm">
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2" />
                <span>10,000+ users</span>
              </div>
              <div className="flex items-center">
                <Heart className="w-4 h-4 mr-2" />
                <span>4.9/5 rating</span>
              </div>
              <div className="flex items-center">
                <RefreshCw className="w-4 h-4 mr-2" />
                <span>99.9% uptime</span>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <img src="/logo.png" alt="Nubo" className="w-8 h-8 rounded-lg" />
                <span className="text-lg font-bold">Nubo</span>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                The open-source email client that respects your privacy.
              </p>
              <div className="flex space-x-4 mt-4">
                <a href="https://github.com/nubo-email" className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
                  <Code className="w-5 h-5" />
                </a>
                <a href="https://twitter.com/nuboemail" className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                <li><a href="#features" className="hover:text-neutral-900 dark:hover:text-neutral-100">Features</a></li>
                <li><a href="#pricing" className="hover:text-neutral-900 dark:hover:text-neutral-100">Pricing</a></li>
                <li><a href="/changelog" className="hover:text-neutral-900 dark:hover:text-neutral-100">Changelog</a></li>
                <li><a href="/roadmap" className="hover:text-neutral-900 dark:hover:text-neutral-100">Roadmap</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                <li><a href="https://docs.nubo.email" className="hover:text-neutral-900 dark:hover:text-neutral-100">Documentation</a></li>
                <li><a href="/api" className="hover:text-neutral-900 dark:hover:text-neutral-100">API Reference</a></li>
                <li><a href="/blog" className="hover:text-neutral-900 dark:hover:text-neutral-100">Blog</a></li>
                <li><a href="/community" className="hover:text-neutral-900 dark:hover:text-neutral-100">Community</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                <li><a href="/about" className="hover:text-neutral-900 dark:hover:text-neutral-100">About</a></li>
                <li><a href="/privacy" className="hover:text-neutral-900 dark:hover:text-neutral-100">Privacy</a></li>
                <li><a href="/terms" className="hover:text-neutral-900 dark:hover:text-neutral-100">Terms</a></li>
                <li><a href="/contact" className="hover:text-neutral-900 dark:hover:text-neutral-100">Contact</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-neutral-200 dark:border-neutral-800 mt-8 pt-8 flex items-center justify-between">
            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              © 2025 Nubo. All rights reserved.
            </div>
            <div className="flex items-center space-x-6 text-sm text-neutral-600 dark:text-neutral-400">
              <span>Made with <Heart className="inline w-4 h-4 text-red-500" /> by the community</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}