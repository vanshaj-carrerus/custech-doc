"use client";

import React, { useState } from "react";
import { ActiveView, UserSession } from "@/types/dochub";
import {
  FileText,
  Menu,
  ChevronDown,
  LogOut,
  User,
  CheckCircle2,
  ShieldCheck,
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
  onToggleSidebar,
  userSession,
  onLogout,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 md:px-6 select-none">
      {/* Left section: Hamburger (mobile) + Brand Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl md:hidden transition"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div
          onClick={() => setActiveView("dashboard")}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 text-white font-bold shadow-md shadow-sky-500/20 group-hover:bg-sky-600 transition-colors">
            <FileText className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span className="text-lg font-black tracking-tight text-slate-900 group-hover:text-sky-600 transition-colors">
            CUS-DOC
          </span>
        </div>
      </div>

      {/* Right section: User Profile Dropdown */}
      <div className="flex items-center gap-3">

        {/* User profile avatar with Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-100/80 transition text-left"
          >
            <div className="h-8 w-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs shadow-sm ring-2 ring-sky-500/20">
              {userSession?.name ? userSession.name.slice(0, 2).toUpperCase() : "U"}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-semibold text-slate-900 leading-tight">
                {userSession?.name || "User"}
              </span>
              <span className="text-[11px] text-slate-400 leading-tight truncate max-w-[140px]">
                {userSession?.email || "user@email.com"}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden p-1 text-xs text-left animate-in fade-in">
              <div className="px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/70 rounded-xl mb-1">
                <p className="font-bold text-slate-900 truncate">
                  {userSession?.name || "User Account"}
                </p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {userSession?.email || "user@email.com"}
                </p>
              </div>

              {userSession?.role === "admin" && (
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    window.location.href = "/admin";
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sky-700 hover:bg-sky-50 rounded-xl font-semibold transition"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Admin Panel</span>
                </button>
              )}

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  if (onLogout) onLogout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl font-semibold transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
