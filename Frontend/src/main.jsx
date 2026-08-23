import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import LoginPage from "./LoginPage.jsx";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider.jsx";
import Homepage from "./Homepage.jsx";
import ErrorBoundary from "./Components/ErrorBoundary.jsx";
import { Toaster } from "react-hot-toast";

const appBasePath = `/${(import.meta.env.VITE_BASE_URL || "/dpr/").replace(/^\/+|\/+$/g, "")}`;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={appBasePath}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Homepage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/create" element={<App />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>

      <Toaster
        position="top-right"
        gutter={10}
        toastOptions={{
          duration: 4000,
          style: {
            background: "#ffffff",
            color: "#1e293b",
            fontSize: "0.875rem",
            fontWeight: 500,
            padding: "10px 14px",
            borderRadius: "10px",
            boxShadow:
              "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
            border: "1px solid #e2e8f0",
          },
          success: {
            iconTheme: { primary: "#16a34a", secondary: "#ffffff" },
            style: { border: "1px solid #bbf7d0" },
          },
          error: {
            iconTheme: { primary: "#dc2626", secondary: "#ffffff" },
            style: { border: "1px solid #fecaca" },
          },
          loading: {
            iconTheme: { primary: "#192aac", secondary: "#ffffff" },
          },
        }}
      />
    </ErrorBoundary>
  </StrictMode>
);
