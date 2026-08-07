import React from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSignOutAlt } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../context/AuthProvider";

const Navbar = () => {
  const { logout, userRole } = useAuth();

  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
      {/* Logo + Text */}
      <div className="flex items-center gap-4">
        <Link to="/dashboard">
          <img
            src={`${import.meta.env.BASE_URL}images/iitg-logo.png`}
            alt="Logo"
            className="size-15 object-contain"
          />
        </Link>
        <Link
          to="/dashboard"
          className="text-lg sm:text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors"
        >
          <span className="hidden sm:inline">Centre For Career Development, IITG</span>
          <span className="inline sm:hidden">CCD, IITG</span>
        </Link>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3">
        {(userRole === "admin" || userRole === "dpr") && (
          <Link
            to="/create"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-all shadow"
          >
            Add Data
          </Link>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow"
        >
          <FontAwesomeIcon icon={faSignOutAlt} className="w-4 h-4" />
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
