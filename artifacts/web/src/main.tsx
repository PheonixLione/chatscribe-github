import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{
          position: "fixed", inset: 0, display: "flex", alignItems: "center",
          justifyContent: "center", background: "#0a0a0f", color: "#f8f8f8",
          fontFamily: "monospace", padding: "2rem",
        }}>
          <div style={{
            maxWidth: 640, width: "100%", background: "#13131a",
            border: "1px solid #222", borderRadius: 12, padding: "2rem",
          }}>
            <h1 style={{ color: "#f87171", marginTop: 0, fontSize: "1.25rem" }}>
              Application Error
            </h1>
            <pre style={{
              background: "#0a0a0f", padding: "1rem", borderRadius: 8,
              overflowX: "auto", fontSize: "0.75rem", color: "#fca5a5",
              whiteSpace: "pre-wrap", wordBreak: "break-all",
            }}>
              {err.message}
              {err.stack ? "\n\n" + err.stack : ""}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
