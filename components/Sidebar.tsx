"use client";

import React from "react";
import { ActiveView, UserSession } from "@/types/dochub";
import {
  LayoutDashboard,
  Inbox,
  Send,
  Files,
  Copy,
  Globe,
  DoorOpen,
  Printer,
  FolderPlus,
  Building,
  Settings,
  Plus,
  ChevronDown,
  UserCheck,
  LogOut,
  CheckCircle2,
} from "lucide-react";

interface SidebarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  userSession?: UserSession;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  isOpenMobile = false,
  onCloseMobile,
  userSession,
  onLogout,
}) => {
  const navItems = [
    {
      id: "dashboard" as ActiveView,
      label: "Dashboard",
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: "completed_docs" as ActiveView,
      label: "Completed Docs",
      icon: CheckCircle2,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 w-64 border-r border-slate-200 bg-white flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
          {/* Top: User profile dropdown */}
          <div
            onClick={() => {
              if (onLogout) onLogout();
            }}
            className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100/80 transition cursor-pointer group"
            title="Click to Switch Account / Log Out"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs flex-shrink-0 shadow-2xs">
                {userSession?.name ? userSession.name.slice(0, 2).toUpperCase() : "JD"}
              </div>
              <div className="flex flex-col text-left min-w-0">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1 group-hover:text-blue-600 transition-colors truncate">
                  {userSession?.name || "Jane Doe"}
                  <UserCheck className="w-3 h-3 text-blue-500 flex-shrink-0" />
                </span>
                <span className="text-[11px] text-slate-500 font-medium truncate">
                  {userSession?.email || "Personal Dashboard"}
                </span>
              </div>
            </div>
            <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-600 transition flex-shrink-0 ml-1" />
          </div>

          {/* Prominent Green 'New Document' Button */}
          <button
            onClick={() => {
              setActiveView("import");
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span className="text-sm">New Document</span>
          </button>

          {/* Navigation Links */}
          <div className="flex flex-col gap-1 mt-2">
            <div className="px-2 pb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Main Menu
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === "dashboard" || item.id === "import" || item.id === "completed_docs") {
                      setActiveView(item.id as ActiveView);
                    } else {
                      setActiveView("completed_docs");
                    }
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-blue-50 text-blue-600 shadow-2xs font-bold"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? "text-blue-600" : "text-slate-500"
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col gap-1">
          <button className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg transition">
            <FolderPlus className="w-4 h-4 text-slate-500" />
            <span>Add Folders</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg transition">
            <Building className="w-4 h-4 text-slate-500" />
            <span>Create New Organization</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg transition">
            <Settings className="w-4 h-4 text-slate-500" />
            <span>Settings</span>
          </button>
        </div>
      </aside>
    </>
  );
};
