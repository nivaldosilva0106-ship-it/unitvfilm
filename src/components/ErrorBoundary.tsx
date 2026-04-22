import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: any;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
    
    // Auto-reload on chunk load errors
    const errorString = String(error);
    const isChunkError = 
      errorString.includes("Failed to fetch dynamically imported module") || 
      errorString.includes("Loading chunk") ||
      errorString.includes("Importing a module script failed") ||
      (errorString.includes("Failed to fetch") && (this.state.error?.stack?.includes("/assets/") || errorString.includes(".js")));

    if (isChunkError) {
      console.warn("Chunk load error detected. Reloading page...");
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '50px', background: '#300', color: 'white', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h1 style={{ color: '#f55' }}>🚨 APP CRASH DETECTADO 🚨</h1>
          <p>Ocorreu um erro fatal que quebrou a tela. Por favor, tira print desta página para analisarmos a origem do crash:</p>
          <pre style={{ background: '#000', padding: '20px', overflowX: 'auto', borderRadius: '8px', border: '1px solid #500' }}>
            {String(this.state.error?.stack || this.state.error)}
          </pre>
          <button 
            onClick={() => window.location.href = '/'}
            style={{ marginTop: '20px', padding: '10px 20px', background: '#f55', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
          >
            Voltar ao Início
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
