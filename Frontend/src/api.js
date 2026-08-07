const DEFAULT_API_BASE_URL = "http://localhost:8081";

export const getApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_BASE_URI?.trim();
  return configured || DEFAULT_API_BASE_URL;
};

export const buildApiUrl = (path) => {
  const base = getApiBaseUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
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
