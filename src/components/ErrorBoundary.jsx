import React from 'react';
import { toast } from 'sonner';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const MAX_RETRIES = 2;

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorKey: 0, retries: 0, lastError: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, lastError: error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught:', error, info?.componentStack);

    if (this.state.retries < MAX_RETRIES) {
      toast.error(error?.message || 'Something went wrong', {
        description: 'A component failed to render. Retrying...',
        duration: 3000,
      });
      setTimeout(() => {
        this.setState((prev) => ({
          hasError: false,
          errorKey: prev.errorKey + 1,
          retries: prev.retries + 1,
        }));
      }, 500);
    }
  }

  render() {
    if (this.state.hasError) {
      // Exhausted retries — show minimal inline error, NOT full page crash
      if (this.state.retries >= MAX_RETRIES) {
        return (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
            <p className="text-sm font-medium text-slate-700 mb-1">This section failed to load</p>
            <p className="text-xs text-slate-400 mb-3">{this.state.lastError?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, retries: 0, errorKey: this.state.errorKey + 1 })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              <RefreshCw className="w-3 h-3" />
              Try Again
            </button>
          </div>
        );
      }
      return null;
    }

    return (
      <React.Fragment key={this.state.errorKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
