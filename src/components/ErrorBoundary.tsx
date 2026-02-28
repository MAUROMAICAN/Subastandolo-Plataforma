import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReload = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-sm p-8 max-w-md w-full text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-warning mx-auto" />
            <h1 className="text-xl font-heading font-bold">Algo salió mal</h1>
            <p className="text-sm text-muted-foreground">
              Ha ocurrido un error inesperado. Intenta recargar la página.
            </p>
            <Button onClick={this.handleReload} className="bg-primary text-primary-foreground">
              <RefreshCw className="h-4 w-4 mr-2" />
              Volver al inicio
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
