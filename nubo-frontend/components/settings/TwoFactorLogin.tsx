'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, Key, AlertCircle } from 'lucide-react';

interface TwoFactorLoginProps {
  isOpen: boolean;
  userId: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TwoFactorLogin({ isOpen, userId, onSuccess, onCancel }: TwoFactorLoginProps) {
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);

  const verifyCode = async () => {
    if (!code || (useBackupCode ? code.length !== 8 : code.length !== 6)) {
      showToast(`Please enter a valid ${useBackupCode ? '8-character backup' : '6-digit'} code`, 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId, 
          token: code,
          isBackupCode: useBackupCode 
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Verification failed');
      }

      const data = await response.json();
      
      // Store the received token and user data
      const { user, token } = data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      showToast('2FA verification successful', 'success');
      onSuccess();
      setCode('');
      setUseBackupCode(false);
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      verifyCode();
    }
  };

  const handleCancel = () => {
    onCancel();
    setCode('');
    setUseBackupCode(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Two-Factor Authentication
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              {useBackupCode ? (
                <Key className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              ) : (
                <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <h3 className="text-lg font-semibold">Verification Required</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {useBackupCode 
                ? 'Enter one of your backup codes'
                : 'Enter the code from your authenticator app'
              }
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="verification-code">
              {useBackupCode ? 'Backup Code' : 'Verification Code'}
            </Label>
            <Input
              id="verification-code"
              type="text"
              placeholder={useBackupCode ? "XXXXXXXX" : "000000"}
              value={code}
              onChange={(e) => {
                const value = useBackupCode 
                  ? e.target.value.toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 8)
                  : e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(value);
              }}
              onKeyPress={handleKeyPress}
              className="text-center font-mono text-lg tracking-wider"
              maxLength={useBackupCode ? 8 : 6}
              autoFocus
            />
          </div>

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                setUseBackupCode(!useBackupCode);
                setCode('');
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {useBackupCode 
                ? 'Use authenticator app instead'
                : 'Use backup code instead'
              }
            </button>
          </div>

          {useBackupCode && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Note:</p>
                  <p className="text-amber-700 dark:text-amber-300">
                    Each backup code can only be used once. After using it, generate new codes from settings.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={verifyCode} 
              disabled={loading || code.length < (useBackupCode ? 8 : 6)}
              className="flex-1"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}