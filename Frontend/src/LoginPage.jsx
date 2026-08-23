import React, { useEffect } from "react";
import { useAuth } from "./context/AuthProvider";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Mail } from "lucide-react";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  useEffect(() => {
    const error = new URLSearchParams(location.search).get("error");
    if (error === "unauthorized") {
      toast.error("User not Authorized, please contact team CCD");
      navigate(location.pathname, { replace: true });
    } else if (error) {
      toast.error("Azure authentication failed. Please try again.");
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  const handleLogin = (e) => {
    e.preventDefault();
    login();
  };

  return (
    <div
      className="w-full h-screen flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: `url('${import.meta.env.BASE_URL}images/login-bg.jpg')` }}
    >
      <div className="w-96 p-8 bg-white/95 shadow-lg rounded-xl text-center font-sans">
        <img
          src={`${import.meta.env.BASE_URL}images/iitg-logo.png`}
          alt="IITG Logo"
          className="w-20 h-20 mx-auto mb-3"
        />

        <h2 className="text-black font-semibold text-xl mb-5 select-none">
          Company Listing Portal
        </h2>

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <button
            type="submit"
            className="w-full py-3 text-base font-semibold text-white bg-[#003366] hover:bg-[#002244] rounded-md transition cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <Mail size={18} aria-hidden="true" />
            Login with Outlook
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
