import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Error capturado por ErrorBoundary", { error, errorInfo });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="mx-auto mt-8 max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 shadow-sm">
          <h1 className="text-xl font-semibold">Se produjo un error inesperado</h1>
          <p className="mt-2 text-sm text-rose-700">
            Recarga la aplicacion para continuar. Si el problema persiste, comparte este incidente con soporte.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-4 rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
          >
            Recargar aplicacion
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
