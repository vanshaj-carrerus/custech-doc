"use client";

import React, { useEffect, useState } from "react";
import { UserSession } from "@/types/dochub";
import { AdminPanelView } from "@/components/AdminPanelView";
import { ShieldAlert } from "lucide-react";

export default function AdminPage() {
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("dochub_current_user");
    const isLoggedOut = localStorage.getItem("dochub_is_logged_out");
    if (savedUser && isLoggedOut !== "true") {
      try {
        setUserSession(JSON.parse(savedUser));
      } catch {
        setUserSession(null);
      }
    }
    setIsLoaded(true);
  }, []);

  if (!isLoaded) return null;

  if (!userSession?.isLoggedIn || userSession.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <ShieldAlert className="w-10 h-10 text-red-500" />
        <h1 className="text-lg font-bold text-slate-900">Admin access required</h1>
        <p className="text-sm text-slate-500 max-w-sm">
          You don't have permission to view this page. Sign in with an admin account to continue.
        </p>
        <a
          href="/"
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition"
        >
          Back to CUS-DOC
        </a>
      </div>
    );
  }

  return (
    <AdminPanelView
      userSession={userSession}
      onBackToDashboard={() => {
        window.location.href = "/";
      }}
    />
  );
}
