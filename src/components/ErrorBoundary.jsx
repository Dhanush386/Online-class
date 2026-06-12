import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // In production you'd send this to a logging service (Sentry, etc.)
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', background: 'var(--bg-main)', padding: '2rem'
        }}>
          <div className="glass-card" style={{
            padding: '2.5rem', maxWidth: 440, width: '100%', textAlign: 'center'
          }}>
            <div style={{
              width: 72, height: 72, background: 'rgba(239,68,68,0.1)',
              borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2.2rem'
            }}>
              💥
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.75rem' }}>
              An unexpected error occurred. Please try refreshing the page.
              If the issue persists, contact support.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre style={{
                textAlign: 'left', background: '#fee2e2', color: '#991b1b',
                borderRadius: 8, padding: '0.75rem', fontSize: '0.72rem',
                overflowX: 'auto', marginBottom: '1.5rem', maxHeight: 120
              }}>
                {this.state.error.toString()}
              </pre>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => window.location.reload()}
                className="btn-primary"
                style={{ flex: 1 }}
              >
                Refresh Page
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
