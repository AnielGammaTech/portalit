import React from 'react';
import { toast } from 'sonner';

/**
 * Graceful error boundary — logs the error, shows a toast, and
 * auto-recovers by re-rendering children instead of nuking the whole page.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorKey: 0 };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught:', error, info?.componentStack);

    // Show a non-blocking toast instead of a full-page crash
    toast.error(error?.message || 'Something went wrong', {
      description: 'A component failed to render. The page will try to recover.',
      duration: 5000,
    });

    // Auto-recover after a brief moment — bump the key to force a fresh render
    setTimeout(() => {
      this.setState((prev) => ({ hasError: false, errorKey: prev.errorKey + 1 }));
    }, 500);
  }

  render() {
    if (this.state.hasError) {
      // Return null briefly while recovering — avoids the full-page error screen
      return null;
    }

    // key change forces React to remount children cleanly after recovery
    return (
      <React.Fragment key={this.state.errorKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
