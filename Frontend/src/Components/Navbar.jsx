import React from "react";
import { Link, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSignOutAlt,
  faHome,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../context/AuthProvider";

const Navbar = () => {
  const { logout, userRole } = useAuth();
  const location = useLocation();

  const canManageData = userRole === "admin" || userRole === "dpr";
  const isCreatePage = location.pathname === "/create";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-blue-900 bg-[#12194e]">
  <nav className="flex h-18 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
    {/* Left side */}
    <Link to="/dashboard" className="flex items-center gap-3">
      <div className="rounded-lg bg-white p-1">
        <img
          src={`${import.meta.env.BASE_URL}images/iitg-logo.png`}
          alt="IIT Guwahati Logo"
          className="h-11 w-11 object-contain"
        />
      </div>

      <div className="leading-tight text-white">
        <p className="text-sm font-semibold sm:text-base">
          Centre For Career Development
        </p>
        <p className="text-xs text-blue-100">IIT Guwahati</p>
      </div>
    </Link>

    {/* Right side */}
    <div className="ml-auto flex items-center gap-2 sm:gap-3">
      {canManageData &&
        (isCreatePage ? (
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
          >
            <FontAwesomeIcon icon={faHome} className="h-4 w-4" />
            Home
          </Link>
        ) : (
          <Link
            to="/create"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#0F3D91] transition hover:bg-blue-50"
          >
            <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
            Add Data
          </Link>
        ))}

      <button
        onClick={logout}
        className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500/20 hover:border-red-300"
      >
        <FontAwesomeIcon icon={faSignOutAlt} className="h-4 w-4" />
        Logout
      </button>
    </div>
  </nav>
</header>
  );
};

export default Navbar;