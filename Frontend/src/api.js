const DEFAULT_API_BASE_URL = "http://localhost:8081";
const API_BASE_PATH = "/dpr";

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
