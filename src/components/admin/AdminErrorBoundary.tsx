import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary für den Admin-Bereich.
 * Fängt JS-Fehler ab, die sonst zu einer weißen Seite führen würden
 * (besonders auf iOS, wo bestimmte Browser-APIs anders verhalten).
 */
export class AdminErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[AdminErrorBoundary] Fehler:", error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f6f7f8] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-border p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h1 className="text-base font-bold">StoriaMaestro – Fehler</h1>
                <p className="text-xs text-muted-foreground">Admin konnte nicht geladen werden</p>
              </div>
            </div>
            <pre className="text-xs text-red-600 bg-red-50 rounded-lg p-3 overflow-auto mb-6 max-h-40">
              {this.state.error?.message || "Unbekannter Fehler"}
            </pre>
            <Button
              onClick={() => window.location.reload()}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Seite neu laden
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
