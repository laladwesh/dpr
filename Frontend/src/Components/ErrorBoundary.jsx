import React from "react";
import { AlertTriangle } from "lucide-react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-50 px-4 text-center font-sans">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 border border-red-100">
          <AlertTriangle className="text-red-500" size={26} />
        </div>
        <h1 className="mt-5 text-xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          An unexpected error occurred while rendering this page. Try reloading — if the
          problem continues, contact team CCD.
        </p>
        <button
          onClick={this.handleReload}
          className="mt-6 rounded-md bg-[#192aac] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#12194e]"
        >
          Reload page
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
