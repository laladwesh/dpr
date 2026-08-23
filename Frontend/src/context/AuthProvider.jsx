import React, { createContext, useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { buildApiUrl, parseJsonResponse } from "../api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = () => {
    window.location.assign(buildApiUrl("/api/auth/azure"));
  };

  const logout = async () => {
    try {
      const response = await fetch(buildApiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        console.warn(`Logout request returned ${response.status}`);
      }
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Could not contact the server. You have been signed out locally.");
    } finally {
      setIsAuthenticated(false);
      setUser(null);
      setUserRole(null);
      navigate("/login", { replace: true });
    }
  };

  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/auth/session"), {
          credentials: "include",
        });
        const data = await parseJsonResponse(response);

        if (response.ok && data?.success && data.user) {
          setIsAuthenticated(true);
          setUser(data.user);
          setUserRole(data.user.role);
        } else {
          setIsAuthenticated(false);
          setUser(null);
          setUserRole(null);
        }
      } catch (error) {
        console.error("Error loading authentication session:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, login, logout, user, loading, userRole }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
