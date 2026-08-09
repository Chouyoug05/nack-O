import React from "react";

type DialogErrorBoundaryState = { hasError: boolean; message: string };

/**
 * ErrorBoundary local pour le contenu des modales (ex: "Vérification du gérant").
 * Si le rendu échoue sur un vieux navigateur, on affiche un message simple avec
 * un bouton "Fermer" garanti au lieu de geler toute l'appli.
 */
export default class DialogErrorBoundary extends React.Component<
  React.PropsWithChildren<{ onClose?: () => void }>,
  DialogErrorBoundaryState
> {
  state: DialogErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): DialogErrorBoundaryState {
    let message = "Le contenu de cette fenêtre n'a pas pu être affiché.";
    try {
      if (error instanceof Error && error.message) message = error.message;
    } catch { /* ignore */ }
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown) {
    try { console.error("Dialog error:", error); } catch { /* ignore */ }
  }

  render() {
    if (this.state.hasError) {
      const { onClose } = this.props;
      return (
        <div style={{ padding: "1rem 0", textAlign: "center" }}>
          <p style={{ fontSize: "0.875rem", color: "#dc2626", marginBottom: "1rem" }}>
            Une erreur est survenue dans cette fenêtre.
          </p>
          {typeof onClose === "function" && (
            <button
              onClick={() => {
                try { onClose(); } catch { /* ignore */ }
                try { this.setState({ hasError: false }); } catch { /* ignore */ }
              }}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.375rem",
                border: "1px solid #ddd",
                background: "#fff",
                color: "#333",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Fermer
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
