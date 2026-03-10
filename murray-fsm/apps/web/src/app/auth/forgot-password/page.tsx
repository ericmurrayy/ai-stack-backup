// Murray's FSM - Forgot Password Page
// =====================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
        }
      );

      if (authError) {
        throw authError;
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-800 rounded-2xl mb-4">
            <span className="text-white text-3xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Murray&apos;s FSM</h1>
          <p className="text-slate-500">Reset your password</p>
        </div>

        <Card>
          {success ? (
            <div className="space-y-4">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                Password reset email sent! Check your inbox for a link to reset your password.
              </div>
              <Link
                href="/auth/login"
                className="block text-center text-sm text-primary-800 hover:text-primary-900 font-medium"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <p className="text-sm text-slate-600">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <Button type="submit" loading={loading} className="w-full">
                Send Reset Link
              </Button>

              <p className="text-center text-sm text-slate-500">
                Remember your password?{' '}
                <Link
                  href="/auth/login"
                  className="text-primary-800 hover:text-primary-900 font-medium"
                >
                  Sign In
                </Link>
              </p>
            </form>
          )}
        </Card>

        <p className="text-center text-sm text-slate-500 mt-4">
          Garage Door Service Management
        </p>
      </div>
    </div>
  );
}
