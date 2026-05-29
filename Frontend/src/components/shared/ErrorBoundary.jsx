/**
 * ErrorBoundary — catches unhandled React render errors and displays a
 * stylized error page with a "copy error payload" utility for rapid bug
 * reporting.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 * Optional props:
 *   fallback  — custom ReactNode to render instead of the default error UI
 *   onError   — callback(error, errorInfo) for external error reporting
 */

import React from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildErrorPayload(error, errorInfo, meta = {}) {
  return {
    timestamp: new Date().toISOString(),
    message: error?.message || String(error),
    name: error?.name || 'UnknownError',
    stack: error?.stack || null,
    componentStack: errorInfo?.componentStack || null,
    url: typeof window !== 'undefined' ? window.location.href : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    ...meta,
  };
}

async function copyToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

// ---------------------------------------------------------------------------
// Class component (required — hooks can't catch render errors)
// ---------------------------------------------------------------------------

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, copied: false };
    this._handleCopy = this._handleCopy.bind(this);
    this._handleReset = this._handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo);
    }
    console.error('[ErrorBoundary] Caught unhandled error:', error, errorInfo);
  }

  _handleReset() {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
  }

  async _handleCopy() {
    const { error, errorInfo } = this.state;
    const payload = buildErrorPayload(error, errorInfo);
    try {
      await copyToClipboard(JSON.stringify(payload, null, 2));
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 3000);
    } catch {
      console.warn('[ErrorBoundary] Failed to copy error payload to clipboard.');
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const { error, copied } = this.state;
    const message = error?.message || 'An unexpected error occurred.';

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          {/* Card */}
          <div className="bg-white rounded-[2rem] shadow-2xl shadow-slate-200/60 overflow-hidden">

            {/* Header bar */}
            <div className="bg-slate-900 px-8 py-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div>
                <h1 className="text-white font-black text-lg leading-tight">Something went wrong</h1>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">
                  Unhandled application error
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-8 py-6 space-y-5">
              {/* Error message */}
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <p className="text-red-700 text-sm font-semibold break-words">{message}</p>
              </div>

              <p className="text-slate-500 text-sm leading-relaxed">
                The page ran into an unexpected problem. You can try reloading, go back to the previous
                page, or copy the error details to share with support.
              </p>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={this._handleReset}
                  className="flex-1 bg-slate-900 text-white text-sm font-black uppercase tracking-widest px-5 py-3 rounded-xl hover:bg-slate-700 transition-colors"
                >
                  Try again
                </button>

                <button
                  onClick={() => window.location.href = '/'}
                  className="flex-1 bg-slate-100 text-slate-700 text-sm font-black uppercase tracking-widest px-5 py-3 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Go home
                </button>
              </div>

              {/* Copy error payload */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Bug reporting
                </p>
                <button
                  onClick={this._handleCopy}
                  className={`w-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2.5 rounded-xl border transition-all ${
                    copied
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {copied ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Copied to clipboard!
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy error payload
                    </>
                  )}
                </button>
                <p className="text-[9px] text-slate-300 mt-1.5 text-center">
                  Copies error message, stack trace, URL, and browser info as JSON.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
