"use client";

import React from "react";
import { ActiveView, UserSession } from "@/types/dochub";
import {
  LayoutDashboard,
  CheckCircle2,
  Upload,
  Plus,
  Settings,
  LogOut,
  FileText,
  LayoutTemplate,
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
    },
    {
      id: "import" as ActiveView,
      label: "File Import",
      icon: Upload,
    },
    {
      id: "completed_docs" as ActiveView,
      label: "Completed Docs",
      icon: CheckCircle2,
    },
    {
      id: "templates" as ActiveView,
      label: "Templates",
      icon: LayoutTemplate,
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 w-64 border-r border-slate-200/80 bg-white flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 select-none ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1">
          {/* New Document Action Button */}
          <button
            onClick={() => {
              setActiveView("import");
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm shadow-sky-500/20 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="text-xs md:text-sm">New Document</span>
          </button>

          {/* Navigation Section */}
          <div className="flex flex-col gap-1 mt-4">
            <div className="px-3 pb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Navigation
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveView(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                    isActive
                      ? "bg-sky-50 text-sky-600 font-bold border-l-4 border-sky-600 shadow-2xs"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? "text-sky-600" : "text-slate-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-1">
          <button
            onClick={() => {
              if (onLogout) onLogout();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition text-left"
          >
            <LogOut className="w-4 h-4 text-red-500" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
