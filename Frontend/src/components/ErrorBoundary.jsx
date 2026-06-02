import React from 'react';

/**
 * ErrorBoundary — catches unhandled React errors and shows a stylized fallback UI
 * with a "copy diagnostic payload" button for rapid issue reporting.
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            copied: false,
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        // Optionally log to external service
        if (typeof this.props.onError === 'function') {
            this.props.onError(error, errorInfo);
        }
    }

    /**
     * Builds a structured diagnostic payload for debugging.
     */
    buildDiagnosticPayload() {
        const { error, errorInfo } = this.state;
        return {
            timestamp: new Date().toISOString(),
            url: typeof window !== 'undefined' ? window.location.href : '',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            error: error
                ? {
                      message: error.message,
                      stack: error.stack?.split('\n').slice(0, 8).join('\n'),
                      name: error.name,
                  }
                : null,
            componentStack: errorInfo?.componentStack
                ? errorInfo.componentStack.split('\n').slice(0, 8).join('\n')
                : null,
        };
    }

    handleCopyDiagnostics = async () => {
        try {
            const payload = JSON.stringify(this.buildDiagnosticPayload(), null, 2);
            await navigator.clipboard.writeText(payload);
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2000);
        } catch {
            // Fallback: select text in a textarea
            const textarea = document.createElement('textarea');
            textarea.value = JSON.stringify(this.buildDiagnosticPayload(), null, 2);
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2000);
        }
    };

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
    };

    render() {
        if (this.state.hasError) {
            // Allow custom fallback via prop
            if (this.props.fallback) {
                return this.props.fallback(
                    this.state.error,
                    this.handleReset,
                    this.buildDiagnosticPayload
                );
            }

            return (
                <div style={styles.container}>
                    <div style={styles.card}>
                        <div style={styles.iconContainer}>
                            <span style={styles.icon}>⚠️</span>
                        </div>
                        <h2 style={styles.title}>
                            {this.props.title || 'Something went wrong'}
                        </h2>
                        <p style={styles.message}>
                            {this.props.message ||
                                'An unexpected error occurred. Our team has been notified.'}
                        </p>

                        {/* Error detail for dev — collapsible */}
                        {process.env.NODE_ENV !== 'production' && (
                            <details style={styles.details}>
                                <summary style={styles.detailsSummary}>
                                    Technical Details
                                </summary>
                                <pre style={styles.pre}>
                                    {this.state.error?.stack}
                                </pre>
                            </details>
                        )}

                        <div style={styles.actions}>
                            <button
                                onClick={this.handleCopyDiagnostics}
                                style={styles.button}
                                onMouseEnter={(e) =>
                                    (e.target.style.background = '#059669')
                                }
                                onMouseLeave={(e) =>
                                    (e.target.style.background = '#10b981')
                                }
                            >
                                {this.state.copied
                                    ? '✓ Copied!'
                                    : '📋 Copy Error Report'}
                            </button>
                            <button
                                onClick={this.handleReset}
                                style={{
                                    ...styles.button,
                                    ...styles.secondaryButton,
                                }}
                                onMouseEnter={(e) =>
                                    (e.target.style.background = '#374151')
                                }
                                onMouseLeave={(e) =>
                                    (e.target.style.background = '#1f2937')
                                }
                            >
                                🔄 Try Again
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

const styles = {
    container: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '24px',
        background: '#0f172a',
    },
    card: {
        background: '#1e293b',
        borderRadius: '16px',
        padding: '40px',
        maxWidth: '520px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        border: '1px solid #334155',
    },
    iconContainer: {
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: '#450a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 20px',
    },
    icon: { fontSize: '28px' },
    title: {
        textAlign: 'center',
        color: '#f1f5f9',
        fontSize: '1.25rem',
        marginBottom: '12px',
        fontWeight: 600,
    },
    message: {
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: '0.9rem',
        lineHeight: 1.5,
        marginBottom: '24px',
    },
    details: {
        background: '#0f172a',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '20px',
    },
    detailsSummary: {
        color: '#64748b',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: 500,
    },
    pre: {
        fontSize: '0.7rem',
        color: '#94a3b8',
        marginTop: '8px',
        maxHeight: '150px',
        overflowY: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
    },
    actions: {
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
    },
    button: {
        flex: 1,
        padding: '10px 16px',
        background: '#10b981',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontWeight: 500,
        transition: 'background 0.2s',
        minWidth: '120px',
    },
    secondaryButton: {
        background: '#1f2937',
        border: '1px solid #374151',
    },
};

export default ErrorBoundary;
