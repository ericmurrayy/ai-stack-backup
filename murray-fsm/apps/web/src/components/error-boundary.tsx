// Murray's FSM - Reusable Error Boundary
// ========================================
// Class-based React error boundary that catches render errors.
// Shows error details in dev, a friendly message in production,
// and a "Try Again" button to reset the boundary.

'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  /** Content to render when there is no error. */
  children: ReactNode;
  /** Optional fallback UI to render instead of the default error screen. */
  fallback?: ReactNode;
  /** Called when an error is caught so the parent can log / report. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Label shown in the heading, e.g. "Jobs" -> "Something went wrong in Jobs" */
  section?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Always log to console for visibility
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Allow a fully custom fallback
    if (this.props.fallback) {
      return this.props.fallback;
    }

    const { error, errorInfo } = this.state;
    const { section } = this.props;
    const isDev = process.env.NODE_ENV === 'development';

    return (
      <div className="flex items-center justify-center min-h-[50vh] px-4">
        <div className="w-full max-w-lg text-center">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50">
            <AlertTriangle className="h-10 w-10 text-red-400" />
          </div>

          {/* Title */}
          <h2 className="mb-2 text-2xl font-bold text-slate-900">
            {section
              ? `Something went wrong in ${section}`
              : 'Something went wrong'}
          </h2>

          {/* User-friendly message */}
          <p className="mb-6 text-sm text-slate-500">
            An unexpected error occurred. You can try again or return to the
            dashboard.
          </p>

          {/* Dev-only details */}
          {isDev && error && (
            <details className="mb-6 rounded-lg border border-red-200 bg-red-50 text-left">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-red-800">
                <Bug className="h-4 w-4" />
                {error.name}: {error.message}
              </summary>

              <div className="border-t border-red-200 px-4 py-3">
                {/* Stack trace */}
                {error.stack && (
                  <pre className="mb-3 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-red-100 p-3 font-mono text-xs text-red-900">
                    {error.stack}
                  </pre>
                )}

                {/* Component stack */}
                {errorInfo?.componentStack && (
                  <>
                    <p className="mb-1 text-xs font-semibold text-red-800">
                      Component Stack
                    </p>
                    <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words rounded bg-red-100 p-3 font-mono text-xs text-red-900">
                      {errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            </details>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
