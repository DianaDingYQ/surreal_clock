import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(err, info) {
    console.error('[ErrorBoundary]', err, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 bg-[#080808] flex flex-col items-center justify-center gap-6 px-12">
          <p className="font-mono text-white/60 text-xs tracking-[0.3em] uppercase">
            Something went wrong
          </p>
          <p className="font-mono text-red-400/70 text-[11px] text-center max-w-lg leading-relaxed">
            {this.state.error.message}
          </p>
          <button
            className="font-mono text-white/25 text-[11px] tracking-widest hover:text-white/60 transition-colors mt-4 uppercase"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
