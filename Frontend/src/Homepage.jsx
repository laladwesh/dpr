import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import CompanyDataPortal from "./Components/CompanyPortal.jsx";
import { useAuth } from "./context/AuthProvider.jsx";
import Loader from "./Components/Loader.jsx";
import Navbar from "./Components/Navbar.jsx";

function HomePage() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect to login page if not authenticated
  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) return <Loader loading={loading} />;

  return (
    <div className="bg-gray-50">
      {/* Navigation Bar */}
      <Navbar />

      {/* Main Content */}
      <main className="px-2 py-2">
        <CompanyDataPortal />
      </main>
    </div>
  );
}

export default HomePage;
