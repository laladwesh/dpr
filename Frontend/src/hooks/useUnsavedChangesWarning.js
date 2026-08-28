import { useEffect } from "react";

// Warns before a tab close/refresh/URL-bar navigation if there's unsaved
// work. Browsers ignore the custom message text and show their own generic
// prompt, but the confirmation dialog itself is what matters.
export function useUnsavedChangesWarning(shouldWarn) {
  useEffect(() => {
    if (!shouldWarn) return undefined;

    const handler = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldWarn]);
}
