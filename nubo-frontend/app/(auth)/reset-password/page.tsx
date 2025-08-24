'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Eye, EyeOff, Check } from 'lucide-react';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError('Invalid or missing reset token');
    }
  }, [searchParams]);

  const isPasswordValid = password.length >= 8;
  const passwordsMatch = password === confirmPassword;
  const canSubmit = isPasswordValid && passwordsMatch && token;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canSubmit) return;
    
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
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
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                success 
                  ? 'bg-green-100 dark:bg-green-900/20' 
                  : 'bg-neutral-900 dark:bg-neutral-100'
              }`}>
                {success ? (
                  <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                ) : (
                  <Mail className="w-8 h-8 text-white dark:text-neutral-900" />
                )}
              </div>
            </div>
            <h1 className="text-3xl font-bold">
              {success ? 'Password updated!' : 'Reset your password'}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              {success 
                ? 'Your password has been successfully updated. You\'ll be redirected to login.'
                : 'Please enter your new password'
              }
            </p>
          </div>

          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full"
                />
              </div>

              {/* Password requirements */}
              <div className="space-y-2 text-xs">
                <div className={`flex items-center space-x-2 ${
                  isPasswordValid ? 'text-green-600 dark:text-green-400' : 'text-neutral-500'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    isPasswordValid ? 'bg-green-600 dark:bg-green-400' : 'bg-neutral-300 dark:bg-neutral-600'
                  }`} />
                  <span>At least 8 characters</span>
                </div>
                <div className={`flex items-center space-x-2 ${
                  passwordsMatch && confirmPassword ? 'text-green-600 dark:text-green-400' : 'text-neutral-500'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    passwordsMatch && confirmPassword ? 'bg-green-600 dark:bg-green-400' : 'bg-neutral-300 dark:bg-neutral-600'
                  }`} />
                  <span>Passwords match</span>
                </div>
              </div>
              
              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-500 text-sm text-center"
                >
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                disabled={loading || !canSubmit}
                className="w-full"
              >
                {loading ? 'Updating password...' : 'Update password'}
              </Button>
            </form>
          ) : (
            <div className="text-center">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                Redirecting you to login page...
              </p>
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  Go to login now
                </Button>
              </Link>
            </div>
          )}

          {!success && (
            <div className="text-center">
              <Link 
                href="/login" 
                className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
              >
                Back to login
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}