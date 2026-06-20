import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: '#ff4d4f', background: '#fff1f0', borderRadius: '8px', margin: '20px' }}>
          <h2>应用发生崩溃</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '10px', padding: '8px 16px', background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            重新加载应用
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
