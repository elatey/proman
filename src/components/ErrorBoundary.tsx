import { Component, type ReactNode } from 'react';

/** Keeps one broken view from blanking the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('[ProMan] view crashed:', error); (window as any).__lastError = String(error?.stack || error); }
  componentDidUpdate(prev: { resetKey?: string }) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="card p-6 max-w-lg text-center">
          <div className="font-semibold">Something went wrong in this view</div>
          <pre className="mt-3 text-left text-xs text-red-600 whitespace-pre-wrap max-h-40 overflow-auto">{String(this.state.error.message)}</pre>
          <button className="btn btn-primary mt-4" onClick={() => this.setState({ error: null })}>Try again</button>
        </div>
      </div>
    );
  }
}
