import React from 'react';

const isChunkLoadError = (error) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i
    .test(error?.message || '');

const RELOAD_FLAG = 'evnet:chunk-reload';

/**
 * Top-level error boundary.
 *
 * - Catches render errors so a single broken screen doesn't blank the app.
 * - After a new deploy, lazily-loaded route chunks from the old build no
 *   longer exist; we reload once automatically to pick up the new build.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[EV-Net] Unhandled UI error', error, info?.componentStack);

    if (isChunkLoadError(error)) {
      try {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, '1');
          window.location.reload();
        }
      } catch {
        // sessionStorage unavailable — fall through to the fallback UI.
      }
    }
  }

  componentDidUpdate(prevProps) {
    // Clear the error when the user navigates elsewhere.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunkError = isChunkLoadError(error);

    return (
      <div
        role="alert"
        style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem 1rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>
          {chunkError ? 'A new version of EV-Net is available' : 'Something went wrong'}
        </h2>
        <p style={{ maxWidth: 420, margin: 0 }}>
          {chunkError
            ? 'Please reload the page to continue.'
            : 'This screen hit an unexpected error. Reloading usually fixes it — your data is safe.'}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <a className="btn btn-secondary" href="/">Go to home</a>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
