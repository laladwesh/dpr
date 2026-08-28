import React, { useEffect } from "react";
import { useAuth } from "./context/AuthProvider";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const MicrosoftLogo = () => (
  <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  useEffect(() => {
    const error = new URLSearchParams(location.search).get("error");
    if (error === "unauthorized") {
      toast.error("Your account isn't authorized for this portal. Contact team CCD.");
      navigate(location.pathname, { replace: true });
    } else if (error) {
      toast.error("Sign-in failed. Please try again.");
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  const handleLogin = (e) => {
    e.preventDefault();
    login();
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-white font-sans text-slate-800">
      <div className="h-[3px] w-full bg-gradient-to-r from-[#f0483e] via-[#e8b03e] to-[#3b6fd6]" />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-[340px]">
          <img
            src={`${import.meta.env.BASE_URL}images/iitg-logo.png`}
            alt="IIT Guwahati"
            className="mx-auto h-12 w-12 object-contain"
          />

          <div className="mt-5 text-center">
            <p className="text-sm font-semibold text-slate-900">Centre for Career Development</p>
            <p className="mt-0.5 text-xs text-slate-400">Company Listing Portal</p>
          </div>

          <form onSubmit={handleLogin} className="mt-10">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2.5 rounded-md border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#192aac] focus:ring-offset-2"
            >
              <MicrosoftLogo />
              Sign in with Microsoft
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Restricted to authorized @iitg.ac.in accounts.
          </p>
        </div>
      </div>

      <p className="pb-8 text-center text-xs text-slate-300">Indian Institute of Technology Guwahati</p>
    </div>
  );
}

export default LoginPage;
