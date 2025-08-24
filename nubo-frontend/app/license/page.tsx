'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LicensePage() {
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
          <h1 className="text-3xl font-bold mb-6">Open Source License</h1>
          <p className="text-sm text-neutral-500 mb-8">GNU Affero General Public License v3.0</p>

          <div className="prose dark:prose-invert max-w-none space-y-6">
            <section className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-neutral-700 dark:text-neutral-300 font-medium">
                Nubo.email is free and open source software licensed under the GNU Affero General Public License v3.0 (AGPLv3)
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">What This Means For You</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-lg mb-2">✅ You Can:</h3>
                  <ul className="list-disc pl-6 space-y-2 text-neutral-600 dark:text-neutral-400">
                    <li>Use Nubo.email for any purpose, including commercial</li>
                    <li>Study how the software works and modify it</li>
                    <li>Distribute copies of the original software</li>
                    <li>Distribute copies of your modified versions</li>
                    <li>Host your own instance of Nubo.email</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-medium text-lg mb-2">📋 Requirements:</h3>
                  <ul className="list-disc pl-6 space-y-2 text-neutral-600 dark:text-neutral-400">
                    <li>Include the original copyright notice and license</li>
                    <li>State any changes you made to the software</li>
                    <li>Make your source code available if you offer it as a network service</li>
                    <li>License your modifications under AGPLv3</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Key Features of AGPLv3</h2>
              <div className="space-y-3">
                <div className="border-l-4 border-green-500 pl-4">
                  <h3 className="font-medium mb-1">Strong Copyleft</h3>
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                    Any derivative work must also be distributed under AGPLv3, ensuring the software remains free.
                  </p>
                </div>
                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-medium mb-1">Network Protection</h3>
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                    If you run a modified version as a web service, you must provide the source code to users.
                  </p>
                </div>
                <div className="border-l-4 border-purple-500 pl-4">
                  <h3 className="font-medium mb-1">Patent Protection</h3>
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                    Contributors grant patent licenses to all users, protecting against patent litigation.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Source Code</h2>
              <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                The complete source code for Nubo.email is available on GitHub:
              </p>
              <a 
                href="https://github.com/koolninad/nubo.email" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-neutral-900 dark:bg-neutral-800 text-white px-4 py-2 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-700 transition-colors"
              >
                View on GitHub
                <ExternalLink className="w-4 h-4" />
              </a>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Contributing</h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                We welcome contributions! By contributing to Nubo.email, you agree to license your contributions 
                under the AGPLv3. Please see our contributing guidelines on GitHub for more information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Full License Text</h2>
              <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                For the complete license text, please visit:
              </p>
              <a 
                href="https://www.gnu.org/licenses/agpl-3.0.html" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                GNU AGPLv3 License
                <ExternalLink className="w-3 h-3" />
              </a>
            </section>

            <section className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg mt-8">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                <strong>Disclaimer:</strong> This software is provided "as is", without warranty of any kind, 
                express or implied. See the license for the full disclaimer of warranties.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}