import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <main className="page" style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
          <div
            className="glass"
            style={{
              maxWidth: 480,
              width: "100%",
              padding: "32px",
              display: "grid",
              gap: 14,
              textAlign: "center"
            }}
          >
            <h2 className="h2">页面出错了</h2>
            <p className="muted">页面加载遇到问题，刷新重试。</p>
            <details style={{ textAlign: "left", fontSize: "0.85rem" }}>
              <summary style={{ cursor: "pointer", color: "var(--gold)" }}>查看错误详情</summary>
              <pre
                style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem",
                  background: "rgba(0,0,0,.25)",
                  borderRadius: "10px",
                  overflow: "auto",
                  fontSize: "0.8rem",
                  fontFamily: "var(--disp)"
                }}
              >
                {this.state.error?.message}
              </pre>
            </details>
            <button className="btn btn-gold" onClick={this.handleReset}>
              重试
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
