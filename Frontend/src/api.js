import toast from "react-hot-toast";

// In prod the backend serves the built frontend itself (same origin), so
// requests should be relative. In dev the Vite server (5173) is separate
// from the API server, so it needs an absolute URL.
const DEFAULT_API_BASE_URL = import.meta.env.DEV ? "http://localhost:8081" : "";
const API_BASE_PATH = `/${(import.meta.env.VITE_BASE_URL || "/dpr/").replace(/^\/+|\/+$/g, "")}`;

export const getApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_BASE_URI?.trim();
  return configured || DEFAULT_API_BASE_URL;
};

export const buildApiUrl = (path) => {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const scopedPath = normalizedPath === API_BASE_PATH || normalizedPath.startsWith(`${API_BASE_PATH}/`)
    ? normalizedPath
    : `${API_BASE_PATH}${normalizedPath}`;
  return `${base}${scopedPath}`;
};

let sessionExpiredNotified = false;
export const apiFetch = async (path, options = {}) => {
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...options,
  });

  if (response.status === 401 && !sessionExpiredNotified) {
    sessionExpiredNotified = true;
    toast.error("You've been signed out. Please log in again.");
    window.setTimeout(() => {
      window.location.assign(`${import.meta.env.BASE_URL}login`);
    }, 600);
  }

  return response;
};

export const parseJsonResponse = async (response) => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};
