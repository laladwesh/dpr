import React, { useEffect } from "react";
import { useAuth } from "./context/AuthProvider";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ClipboardList, Users, ShieldCheck } from "lucide-react";

const MicrosoftLogo = () => (
  <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

const highlights = [
  {
    icon: ClipboardList,
    title: "One list, every company",
    text: "Track outreach status for every point of contact in a single place.",
  },
  {
    icon: Users,
    title: "Built for the whole team",
    text: "DPRs list companies, coordinators run outreach, admins keep oversight.",
  },
  {
    icon: ShieldCheck,
    title: "Signed in as you",
    text: "Access is tied to your official IITG account — no separate password.",
  },
];

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
    <div className="flex min-h-screen w-full flex-col bg-white font-sans text-slate-800 lg:flex-row">
      {/* Brand / hero panel */}
      <div className="relative flex min-h-[38vh] shrink-0 items-end overflow-hidden bg-[#0b1030] lg:min-h-screen lg:w-[56%] lg:items-center">
        <img
          src={`${import.meta.env.BASE_URL}images/login-bg.jpg`}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1030] via-[#0b1030]/80 to-[#0b1030]/20 lg:bg-gradient-to-r lg:from-[#0b1030] lg:via-[#0b1030]/85 lg:to-[#0b1030]/30" />

        <div className="relative z-10 flex w-full flex-col gap-10 px-6 pb-10 pt-16 sm:px-12 lg:px-16 lg:pb-16 lg:pt-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white p-1.5 shadow-lg">
              <img
                src={`${import.meta.env.BASE_URL}images/iitg-logo.png`}
                alt="IIT Guwahati"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="leading-tight text-white">
              <p className="text-sm font-semibold">Centre for Career Development</p>
              <p className="text-xs text-white/60">Indian Institute of Technology Guwahati</p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
              Company Listing Portal
            </p>
            <h1 className="font-display max-w-lg text-4xl font-medium leading-[1.1] text-white sm:text-5xl">
              Placement season, coordinated in one place.
            </h1>
          </div>

          <div className="hidden flex-col gap-5 border-t border-white/15 pt-8 sm:flex">
            {highlights.map((item) => {
              const HighlightIcon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-blue-200">
                    <HighlightIcon size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-sm text-white/60">{item.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="flex flex-1 items-start justify-center px-6 pb-12 pt-12 sm:px-12 lg:items-center lg:px-16 lg:py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-2 text-sm text-slate-500">
            Continue with your official IITG Outlook account to access the portal.
          </p>

          <form onSubmit={handleLogin} className="mt-8">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-md border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#192aac] focus:ring-offset-2"
            >
              <MicrosoftLogo />
              Sign in with Microsoft
            </button>
          </form>

          <p className="mt-6 text-xs leading-relaxed text-slate-400">
            Only pre-authorized @iitg.ac.in accounts can access this portal. Trouble signing
            in? Reach out to team CCD.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
