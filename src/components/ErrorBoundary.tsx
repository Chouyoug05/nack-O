import React from "react";

type ErrorBoundaryState = { hasError: boolean };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<object>, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
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
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="max-w-md w-full text-center space-y-4">
            <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
            <p className="text-sm text-muted-foreground">Veuillez recharger la page. Si le problème persiste, contactez le support.</p>
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-md bg-black text-white">Recharger</button>
              <a href="/" className="px-4 py-2 rounded-md border">Aller à l’accueil</a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
} 