import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            textAlign: 'center',
            padding: '2rem',
            direction: 'rtl',
          }}
        >
          <h2 style={{ marginBottom: '1rem' }}>משהו השתבש</h2>
          <p style={{ marginBottom: '1.5rem', color: '#5f6368' }}>אירעה שגיאה בלתי צפויה. נסה לרענן את האפליקציה.</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#1a73e8',
              color: 'white',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            רענון
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
