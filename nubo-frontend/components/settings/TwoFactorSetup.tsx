'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Smartphone, Key, Copy, Download, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import Image from 'next/image';

interface TwoFactorSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TwoFactorSetup({ isOpen, onClose, onSuccess }: TwoFactorSetupProps) {
  const { showToast } = useToast();
  const [step, setStep] = useState(1); // 1: Setup, 2: Verify, 3: Backup Codes
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const setupTwoFactor = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch('/api/2fa/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to setup 2FA');
      }

      const data = await response.json();
      setQrCode(data.qrcode);
      setSecret(data.secret);
      setStep(2);
    } catch (error) {
      showToast((error as Error).message, 'error');
      // Close the modal if there's an error
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const verifySetup = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      showToast('Please enter a valid 6-digit code', 'error');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch('/api/2fa/verify-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ token: verificationCode }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to verify 2FA');
      }

      const data = await response.json();
      setBackupCodes(data.backupCodes);
      setStep(3);
      showToast('2FA has been successfully enabled!', 'success');
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    showToast('Secret copied to clipboard', 'success');
  };

  const copyBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    navigator.clipboard.writeText(codesText);
    showToast('Backup codes copied to clipboard', 'success');
  };

  const downloadBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    const blob = new Blob([`Nubo.email 2FA Backup Codes\nGenerated: ${new Date().toISOString()}\n\n${codesText}\n\nKeep these codes safe! Each can only be used once.`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nubo-2fa-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleComplete = () => {
    onSuccess();
    onClose();
    setStep(1);
    setQrCode('');
    setSecret('');
    setVerificationCode('');
    setBackupCodes([]);
  };

  useEffect(() => {
    if (isOpen && step === 1) {
      setupTwoFactor();
    }
  }, [isOpen]);

  const handleClose = () => {
    onClose();
    setStep(1);
    setQrCode('');
    setSecret('');
    setVerificationCode('');
    setBackupCodes([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Enable Two-Factor Authentication
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold">Setting up 2FA...</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Please wait while we generate your authentication code.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Scan QR Code</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </p>
            </div>

            {qrCode && (
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg">
                  <Image 
                    src={qrCode} 
                    alt="2FA QR Code" 
                    width={200} 
                    height={200}
                    className="border border-neutral-200"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs text-neutral-600 dark:text-neutral-400">
                Can't scan? Enter this code manually:
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={secret}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copySecret}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verification-code">Enter verification code from your app</Label>
              <Input
                id="verification-code"
                type="text"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center font-mono text-lg tracking-wider"
                maxLength={6}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={verifySetup} 
                disabled={loading || verificationCode.length !== 6}
                className="flex-1"
              >
                {loading ? 'Verifying...' : 'Verify & Enable'}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold">2FA Enabled Successfully!</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Save these backup codes in a safe place. Each can only be used once.
              </p>
            </div>

            <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Backup Codes</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyBackupCodes}
                    className="h-8 px-2"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={downloadBackupCodes}
                    className="h-8 px-2"
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, index) => (
                  <div key={index} className="bg-white dark:bg-neutral-800 rounded px-2 py-1 font-mono text-sm text-center">
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Important:</p>
                  <p className="text-amber-700 dark:text-amber-300">
                    Store these codes securely. If you lose access to your authenticator app, 
                    these are the only way to regain access to your account.
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={handleComplete} className="w-full">
              Complete Setup
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}