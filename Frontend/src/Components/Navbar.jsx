import React from "react";
import { Link, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSignOutAlt,
  faHome,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../context/AuthProvider";

const ROLE_LABELS = {
  admin: "Admin",
  sc: "Coordinator",
  dpr: "DPR",
};

const Navbar = () => {
  const { logout, userRole, user } = useAuth();
  const location = useLocation();

  const canManageData = userRole === "admin" || userRole === "dpr";
  const isCreatePage = location.pathname === "/create";
  const roleLabel = ROLE_LABELS[userRole];

  return (
    <header className="sticky top-0 z-50 w-full bg-[#12194e]">
      <div className="h-[3px] w-full bg-gradient-to-r from-[#f0483e] via-[#e8b03e] to-[#3b6fd6]" />
      <nav className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="rounded-lg bg-white p-1">
            <img
              src={`${import.meta.env.BASE_URL}images/iitg-logo.png`}
              alt="IIT Guwahati Logo"
              className="h-10 w-10 object-contain"
            />
          </div>

          <div className="leading-tight text-white">
            <p className="font-display text-sm font-semibold sm:text-base">
              Centre for Career Development
            </p>
            <p className="text-xs text-blue-200/70">IIT Guwahati</p>
          </div>
        </Link>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {roleLabel && (
            <div
              className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] py-1.5 pl-1.5 pr-3.5 sm:flex"
              title={user?.email || ""}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-400/20 text-[11px] font-bold text-blue-200">
                {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
              </span>
              <span className="text-xs font-semibold text-white/80">{roleLabel}</span>
            </div>
          )}

          {canManageData &&
            (isCreatePage ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.12]"
              >
                <FontAwesomeIcon icon={faHome} className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </Link>
            ) : (
              <Link
                to="/create"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#12194e] transition hover:bg-blue-50"
              >
                <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
                <span className="hidden sm:inline">Add Data</span>
              </Link>
            ))}

          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:border-red-300/40 hover:bg-red-500/20"
          >
            <FontAwesomeIcon icon={faSignOutAlt} className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
