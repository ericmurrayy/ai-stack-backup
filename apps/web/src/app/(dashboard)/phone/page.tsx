import { Metadata } from 'next';
import { CallLog } from '@/components/phone/CallLog';
import { Card } from '@/components/ui/Card';
import { Phone, Settings, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Phone AI | Murray\'s FSM',
  description: 'AI-powered phone answering for your business',
};

export default async function PhonePage() {
  // Check if Retell is configured
  let phoneConfigured = false;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/phone`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      phoneConfigured = data.configured;
    }
  } catch (error) {
    // Ignore - will show setup instructions
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Phone AI</h1>
          <p className="text-gray-500 mt-1">
            AI-powered phone answering, booking, and customer service
          </p>
        </div>

        {phoneConfigured && (
          <a
            href="https://dashboard.retellai.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
          >
            <Settings className="h-4 w-4 mr-2" />
            Retell Dashboard
            <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        )}
      </div>

      {/* Setup Card (if not configured) */}
      {!phoneConfigured && (
        <Card className="p-6 border-yellow-200 bg-yellow-50">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-yellow-100">
              <Phone className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Set Up Phone AI</h3>
              <p className="text-gray-600 mt-1">
                Connect Retell AI to enable 24/7 phone answering for your business.
                Your AI assistant can:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Answer calls instantly, 24/7
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Book appointments directly into your schedule
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Answer common questions about your services
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Transfer urgent calls to you
                </li>
              </ul>

              <div className="mt-4 p-4 bg-white rounded-lg border">
                <p className="text-sm font-medium mb-2">
                  Add these to your <code className="bg-gray-100 px-1 rounded">.env.local</code>:
                </p>
                <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto">
{`RETELL_API_KEY=your_api_key
RETELL_AGENT_ID=your_agent_id
RETELL_PHONE_NUMBER=+1234567890
RETELL_WEBHOOK_SECRET=your_webhook_secret`}
                </pre>
              </div>

              <div className="mt-4 flex gap-2">
                <a
                  href="https://www.retellai.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Get Started with Retell AI
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Call Log */}
      <CallLog />
    </div>
  );
}
