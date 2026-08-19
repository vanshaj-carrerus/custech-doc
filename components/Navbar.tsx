"use client";

import React from "react";
import { ActiveView, UserSession } from "@/types/dochub";
import {
  FileText,
  Zap,
  LayoutDashboard,
  Upload,
  FileEdit,
  Menu,
  ChevronDown,
  LogOut,
  UserCheck,
} from "lucide-react";

interface NavbarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  onOpenWalkthrough?: () => void;
  onToggleSidebar?: () => void;
  userSession?: UserSession;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  setActiveView,
  onOpenWalkthrough,
  onToggleSidebar,
  userSession,
  onLogout,
}) => {
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6 shadow-xs">
      {/* Left section: Hamburger (mobile) + DocHub Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg md:hidden transition"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div
          onClick={() => setActiveView("dashboard")}
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
              DocHub
            </span>
          </div>
        </div>

        {/* View mode indicator / switcher pills */}
        <div className="hidden lg:flex items-center ml-8 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveView("dashboard")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeView === "dashboard"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveView("import")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeView === "import"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            File Import
          </button>
        </div>
      </div>

      {/* Right section: Avatar */}
      <div className="flex items-center gap-2 md:gap-3">

        {/* Divider */}
        <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden sm:block"></div>

        {/* User profile avatar with Dropdown */}
        <div className="relative">
          <div
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 pl-1 cursor-pointer hover:opacity-95 transition"
          >
            <div className="relative">
              <div className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-xs ring-2 ring-blue-500/20">
                {userSession?.name ? userSession.name.slice(0, 2).toUpperCase() : "JD"}
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-800 leading-tight">
                {userSession?.name || "Jane Doe"}
              </span>
              <span className="text-[11px] text-slate-500 leading-tight truncate max-w-[120px]">
                {userSession?.email || "jane.doe@dochub.com"}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden xl:block" />
          </div>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden py-1.5 text-xs text-left animate-in fade-in">
              <div className="px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/70">
                <p className="font-bold text-slate-900 flex items-center gap-1">
                  {userSession?.name || "Jane Doe"}
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                </p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {userSession?.email || "jane.doe@dochub.com"}
                </p>
              </div>

              <div className="p-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl font-bold transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out to Login Screen</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
