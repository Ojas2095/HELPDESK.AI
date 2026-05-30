import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Log to console in development, report to monitoring in production
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    } else {
      // Production: report to monitoring endpoint (non-blocking)
      try {
        fetch('/api/error-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: error?.message,
            componentStack: errorInfo?.componentStack,
            url: window.location.href,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {}); // Silently ignore report failures
      } catch (_) {} // Never let reporting break the error boundary
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          retry: this.handleRetry,
          reload: this.handleReload,
        });
      }

      return (
        <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
          <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-slate-800">
              Something went wrong
            </h2>
            <p className="mb-6 text-sm text-slate-500">
              An unexpected error occurred while loading this section. You can
              try again or reload the page.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Reload Page
              </button>
            </div>
            {import.meta.env.DEV && this.state.errorInfo && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-xs text-slate-400">
                  Error Details (dev only)
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs text-red-600">
                  {this.state.error?.toString()}
                  {'\n'}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
