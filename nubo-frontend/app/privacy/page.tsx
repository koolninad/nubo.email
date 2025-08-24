'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-8">
          <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
          <p className="text-sm text-neutral-500 mb-8">Last updated: January 2025</p>

          <div className="prose dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
              <p className="text-neutral-600 dark:text-neutral-400 mb-3">
                Nubo.email collects only the minimum information necessary to provide our email management service:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-neutral-600 dark:text-neutral-400">
                <li>Your Nubo account credentials (username, email, hashed password)</li>
                <li>Email account credentials (IMAP/SMTP settings) - encrypted at rest</li>
                <li>Email metadata for caching and performance (subject, sender, date)</li>
                <li>User preferences and settings</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                We use your information solely to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-neutral-600 dark:text-neutral-400">
                <li>Authenticate and authorize access to your account</li>
                <li>Connect to your email accounts via IMAP/SMTP</li>
                <li>Display and manage your emails</li>
                <li>Improve our service performance and user experience</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Data Security</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                We implement industry-standard security measures including:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-neutral-600 dark:text-neutral-400">
                <li>Encryption of sensitive data at rest and in transit</li>
                <li>Secure password hashing using bcrypt</li>
                <li>Two-factor authentication support</li>
                <li>Regular security audits and updates</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Data Sharing</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                We <strong>never</strong> sell, rent, or share your personal information with third parties. 
                Your email content and credentials remain private and are only accessible to you.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                - Email cache: 4 hours for body content, 5 minutes for lists<br/>
                - Trash and spam: Automatically deleted after 30 days<br/>
                - Account data: Retained until you delete your account
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                You have the right to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-neutral-600 dark:text-neutral-400">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Delete your account and all associated data</li>
                <li>Export your data in a portable format</li>
                <li>Opt-out of non-essential communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Open Source Commitment</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                Nubo.email is open source. You can review our code, contribute improvements, 
                and even self-host your own instance for complete data control.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Contact Us</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                For privacy concerns or questions, contact us at:<br/>
                Email: privacy@nubo.email<br/>
                GitHub: <a href="https://github.com/koolninad/nubo.email" className="text-blue-600 hover:underline">github.com/koolninad/nubo.email</a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}