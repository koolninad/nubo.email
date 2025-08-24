'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TermsOfServicePage() {
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
          <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
          <p className="text-sm text-neutral-500 mb-8">Effective Date: January 2025</p>

          <div className="prose dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                By accessing or using Nubo.email, you agree to be bound by these Terms of Service. 
                If you do not agree to these terms, please do not use our service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Service Description</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                Nubo.email is an open-source webmail client that allows you to manage multiple email 
                accounts in one unified interface. We do not provide email hosting services; 
                you bring your own IMAP/SMTP credentials.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. User Responsibilities</h2>
              <p className="text-neutral-600 dark:text-neutral-400">You are responsible for:</p>
              <ul className="list-disc pl-6 space-y-2 text-neutral-600 dark:text-neutral-400">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Ensuring your email account credentials are valid and authorized</li>
                <li>Complying with your email provider's terms of service</li>
                <li>Using the service in compliance with all applicable laws</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Prohibited Uses</h2>
              <p className="text-neutral-600 dark:text-neutral-400">You may not use Nubo.email to:</p>
              <ul className="list-disc pl-6 space-y-2 text-neutral-600 dark:text-neutral-400">
                <li>Send spam or unsolicited bulk emails</li>
                <li>Violate any laws or regulations</li>
                <li>Infringe on intellectual property rights</li>
                <li>Transmit malware or harmful code</li>
                <li>Attempt to gain unauthorized access to systems</li>
                <li>Interfere with or disrupt the service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Service Availability</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                While we strive for 100% uptime, we do not guarantee uninterrupted access to the service. 
                We reserve the right to modify, suspend, or discontinue the service at any time with reasonable notice.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Limitation of Liability</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                NUBO.EMAIL IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. WE ARE NOT LIABLE FOR:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-neutral-600 dark:text-neutral-400">
                <li>Loss of data or emails</li>
                <li>Service interruptions or delays</li>
                <li>Indirect, incidental, or consequential damages</li>
                <li>Actions taken by your email provider</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Open Source License</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                Nubo.email is licensed under the GNU Affero General Public License v3.0 (AGPLv3). 
                You are free to use, modify, and distribute the software in accordance with the license terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Termination</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                We reserve the right to terminate or suspend your account for violation of these terms. 
                You may delete your account at any time through the settings page.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Changes to Terms</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                We may update these terms from time to time. Continued use of the service after changes 
                constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Contact Information</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                For questions about these terms, contact us at:<br/>
                Email: legal@nubo.email<br/>
                GitHub: <a href="https://github.com/koolninad/nubo.email" className="text-blue-600 hover:underline">github.com/koolninad/nubo.email</a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}