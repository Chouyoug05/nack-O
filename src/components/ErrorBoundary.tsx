import React from "react";
import { detectBrowserLevel, getUnsupportedMessage } from "@/lib/browserDetect";

type ErrorBoundaryState = { hasError: boolean; browserLevel: 'modern' | 'compatibility' | 'unsupported' };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<object>, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, browserLevel: 'modern' };

  static getDerivedStateFromError(): ErrorBoundaryState {
    const level = typeof detectBrowserLevel === 'function' ? detectBrowserLevel() : 'modern';
    return { hasError: true, browserLevel: level };
  }

  componentDidCatch(error: unknown) {
    try {
      console.error("Unhandled error:", error);
    } catch {
      // ignore
    }
  }

  render() {
    if (this.state.hasError) {
      const isUnsupported = this.state.browserLevel === 'unsupported';

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          backgroundColor: '#faf8f5',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: '#222',
        }}>
          <div style={{ maxWidth: '28rem', width: '100%', textAlign: 'center' }}>
            {/* Logo */}
            <div style={{ marginBottom: '1.5rem' }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: '0 auto' }}>
                <rect width="48" height="48" rx="12" fill="#dc2626"/>
                <text x="24" y="32" textAnchor="middle" fill="white" fontSize="24" fontWeight="bold" fontFamily="sans-serif">N</text>
              </svg>
            </div>

            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
              {isUnsupported ? "Appareil non compatible" : "Une erreur est survenue"}
            </h1>

            <p style={{ fontSize: '0.875rem', color: '#666', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              {isUnsupported
                ? getUnsupportedMessage()
                : "Veuillez recharger la page. Si le problème persiste, contactez le support."
              }
            </p>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.5rem 1.5rem',
                  borderRadius: '0.375rem',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Recharger
              </button>
              <a
                href="/"
                style={{
                  padding: '0.5rem 1.5rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #ddd',
                  textDecoration: 'none',
                  color: '#333',
                  fontSize: '0.875rem',
                }}
              >
                Aller à l'accueil
              </a>
            </div>

            {/* Info appareil pour le support */}
            {isUnsupported && (
              <details style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#999' }}>
                <summary style={{ cursor: 'pointer' }}>Informations techniques</summary>
                <p style={{ marginTop: '0.5rem', wordBreak: 'break-all' }}>
                  {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}
                </p>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
