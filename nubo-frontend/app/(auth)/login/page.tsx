'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { authApi } from '@/lib/api';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail } from 'lucide-react';
import { TwoFactorLogin } from '@/components/settings/TwoFactorLogin';
import { useToast } from '@/components/ui/toast';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setToken } = useStore();
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      showToast('Please enter your username and password', 'error');
      return;
    }
    
    setLoading(true);

    try {
      const response = await authApi.login(username, password);
      const data = response.data;
      
      // Check if 2FA is required
      if (data.requiresTwoFactor) {
        setUserId(data.userId);
        setShow2FA(true);
        setLoading(false);
        showToast('Please enter your 2FA code', 'info');
        return;
      }

      const { user, token } = data;
      
      // Store token and user data with proper expiration handling
      if (rememberMe) {
        // Store in localStorage for 30 days
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('loginExpiry', (Date.now() + 30 * 24 * 60 * 60 * 1000).toString());
      } else {
        // Store in sessionStorage for current session only
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(user));
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('loginExpiry');
      }
      
      setUser(user);
      setToken(token);
      
      showToast(`Welcome back, ${user.username}!`, 'success');
      
      setTimeout(() => {
        router.push('/inbox');
      }, 500);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Invalid username or password';
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handle2FASuccess = () => {
    // 2FA verification will return user and token
    // The TwoFactorLogin component handles the token storage
    router.push('/inbox');
  };

  const handle2FACancel = () => {
    setShow2FA(false);
    setUserId(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8"
      >
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-neutral-900 dark:bg-neutral-100 rounded-2xl flex items-center justify-center">
                <Mail className="w-8 h-8 text-white dark:text-neutral-900" />
              </div>
            </div>
            <h1 className="text-3xl font-bold">Welcome back</h1>
            <p className="text-neutral-600 dark:text-neutral-400">Sign in to your Nubo account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Username or email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full"
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <label htmlFor="remember" className="text-sm text-neutral-600 dark:text-neutral-400">
                  Remember me
                </label>
              </div>
              <Link 
                href="/forgot-password" 
                className="text-sm hover:underline text-neutral-600 dark:text-neutral-400"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="text-center text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">
              Don&apos;t have an account?{' '}
            </span>
            <Link href="/signup" className="font-medium hover:underline">
              Sign up
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Two-Factor Authentication Modal */}
      {show2FA && userId && (
        <TwoFactorLogin
          isOpen={show2FA}
          userId={userId}
          onSuccess={handle2FASuccess}
          onCancel={handle2FACancel}
        />
      )}
    </div>
  );
}