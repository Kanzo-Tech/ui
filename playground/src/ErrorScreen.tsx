import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * A dev-only error surface: when a scene throws, show the message + stack ON THE PAGE
 * instead of a white screen, so a crash can be read without opening the console.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; info: ErrorInfo | null }
> {
  state = { error: null as Error | null, info: null as ErrorInfo | null };

  static getDerivedStateFromError(error: Error) {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info });
    // Keep the console copy too.
    console.error("[playground] scene crashed:", error, info);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          overflow: "auto",
          padding: "2rem",
          background: "#1a0000",
          color: "#ffd7d7",
          fontFamily: "ui-monospace, monospace",
          fontSize: "13px",
          lineHeight: 1.6,
        }}
      >
        <h1 style={{ fontSize: "18px", marginBottom: "1rem", color: "#ff6b6b" }}>
          Scene crashed
        </h1>
        <strong>{error.name}: {error.message}</strong>
        <pre style={{ whiteSpace: "pre-wrap", marginTop: "1rem" }}>
          {error.stack}
        </pre>
        {info?.componentStack && (
          <pre
            style={{ whiteSpace: "pre-wrap", marginTop: "1rem", opacity: 0.7 }}
          >
            {info.componentStack}
          </pre>
        )}
      </div>
    );
  }
}
