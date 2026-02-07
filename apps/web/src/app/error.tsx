'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
        <p className="text-slate-600 mb-6">
          We encountered an unexpected error. Please try again or return to the home page.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={reset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Button onClick={() => window.location.href = '/dashboard'}>
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mt-6 p-4 bg-slate-100 rounded-lg text-left">
            <p className="text-xs text-slate-500 font-mono break-all">{error.message}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
