import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default ({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };
  const configuredBase = process.env.VITE_BASE_URL?.trim();
  const basePath = configuredBase
    ? `/${configuredBase.replace(/^\/+|\/+$/g, "")}/`
    : "/dpr/";

  return defineConfig({
    base: basePath,
    plugins: [react(), tailwindcss()],
    host: true,
  });
};
