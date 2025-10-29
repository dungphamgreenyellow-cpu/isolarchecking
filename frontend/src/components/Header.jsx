import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function Header() {
  const { pathname } = useLocation();

  return (
    <header className="fixed top-0 left-0 w-full bg-white/70 backdrop-blur-md border-b border-gray-200 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-5 py-2">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <span className="text-xl">⚡</span>
          <Link
            to="/"
            className="text-lg md:text-xl font-semibold text-blue-700 hover:text-blue-800 transition"
          >
            iSolarChecking
          </Link>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-gray-600">
          <Link
            to="/"
            className={`hover:text-blue-700 transition ${
              pathname === "/" ? "text-blue-700 font-semibold" : ""
            }`}
          >
            Home
          </Link>
          <Link
            to="/report"
            className={`hover:text-blue-700 transition ${
              pathname === "/report" ? "text-blue-700 font-semibold" : ""
            }`}
          >
            Report
          </Link>
        </nav>

        {/* Login / Register */}
        <button className="text-sm md:text-[15px] px-4 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 transition">
          Login / Register
        </button>
      </div>
    </header>
  );
}
