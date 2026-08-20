"use client";

import React, { useEffect, useState, useCallback } from "react";
import { UserSession } from "@/types/dochub";
import {
  ShieldCheck,
  Users,
  Check,
  X,
  Trash2,
  Loader2,
  Clock,
  ArrowLeft,
  ShieldAlert,
  Crown,
} from "lucide-react";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: string;
  avatarUrl?: string;
  role: "admin" | "user";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface AdminPanelViewProps {
  userSession: UserSession;
  onBackToDashboard: () => void;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  userSession,
  onBackToDashboard,
}) => {
  const adminEmail = userSession.email;
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/admin/users?adminEmail=${encodeURIComponent(adminEmail)}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      } else {
        setErrorMessage(data.message || "Failed to load users");
      }
    } catch {
      setErrorMessage("Unable to connect to server. Please try again.");
    }
    setIsLoading(false);
  }, [adminEmail]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const updateUser = async (id: string, changes: { status?: string; role?: string }) => {
    setPendingActionId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail, ...changes }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data.user } : u)));
      } else {
        setErrorMessage(data.message || "Update failed");
      }
    } catch {
      setErrorMessage("Unable to connect to server. Please try again.");
    }
    setPendingActionId(null);
  };

  const removeUser = async (id: string) => {
    setPendingActionId(id);
    try {
      const res = await fetch(
        `/api/admin/users/${id}?adminEmail=${encodeURIComponent(adminEmail)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
      } else {
        setErrorMessage(data.message || "Remove failed");
      }
    } catch {
      setErrorMessage("Unable to connect to server. Please try again.");
    }
    setPendingActionId(null);
  };

  const filteredUsers = users.filter((u) => filterTab === "all" || u.status === filterTab);
  const pendingCount = users.filter((u) => u.status === "pending").length;

  const statusBadge = (status: AdminUser["status"]) => {
    if (status === "pending")
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/70 text-[11px] font-bold">
          <Clock className="w-3 h-3" /> Pending
        </span>
      );
    if (status === "approved")
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-[11px] font-bold">
          <Check className="w-3 h-3" /> Approved
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200/70 text-[11px] font-bold">
        <X className="w-3 h-3" /> Rejected
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900 antialiased">
      {/* Top bar */}
      <header className="h-16 bg-white border-b border-slate-200/80 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4 text-sky-600" />
            <span>Dashboard</span>
          </button>
          <div className="h-4 w-[1px] bg-slate-200"></div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-sky-600" />
            <span className="font-extrabold text-sm text-slate-900">Admin Panel</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 bg-sky-50 text-sky-700 border border-sky-200/60 px-3 py-1 rounded-full text-xs font-bold">
          <Crown className="w-3.5 h-3.5" />
          <span>{userSession.name}</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-semibold border border-sky-200/60 mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>User Management</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Manage Portal Users
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-xl">
            Approve new sign-up requests, manage roles, and remove accounts.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200/80 rounded-2xl text-red-800 text-xs font-medium flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200/80 w-fit text-xs font-bold shadow-sm">
          {(["all", "pending", "approved", "rejected"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-4 py-2 rounded-xl transition-all capitalize flex items-center gap-1.5 ${
                filterTab === tab
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>{tab}</span>
              {tab === "pending" && pendingCount > 0 && (
                <span className={`px-1.5 rounded-full text-[10px] ${filterTab === tab ? "bg-white/20" : "bg-amber-100 text-amber-700"}`}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Users table */}
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading users...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <Users className="w-8 h-8" />
              <span className="text-sm font-medium">No users in this category</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="px-5 py-3.5 font-bold">User</th>
                    <th className="px-5 py-3.5 font-bold">Role</th>
                    <th className="px-5 py-3.5 font-bold">Status</th>
                    <th className="px-5 py-3.5 font-bold">Joined</th>
                    <th className="px-5 py-3.5 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const isSelf = u.email.toLowerCase() === adminEmail.toLowerCase();
                    const busy = pendingActionId === u.id;
                    return (
                      <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-[11px] flex-shrink-0">
                              {u.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate max-w-[180px]">{u.name}</p>
                              <p className="text-slate-400 truncate max-w-[180px]">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {u.role === "admin" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200/70 text-[11px] font-bold">
                              <Crown className="w-3 h-3" /> Admin
                            </span>
                          ) : (
                            <span className="text-slate-500 font-semibold">User</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">{statusBadge(u.status)}</td>
                        <td className="px-5 py-3.5 text-slate-400">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {u.status !== "approved" && (
                              <button
                                disabled={busy}
                                onClick={() => updateUser(u.id, { status: "approved" })}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition disabled:opacity-40"
                                title="Approve"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {u.status !== "rejected" && (
                              <button
                                disabled={busy}
                                onClick={() => updateUser(u.id, { status: "rejected" })}
                                className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition disabled:opacity-40"
                                title="Reject"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!isSelf && (
                              <button
                                disabled={busy}
                                onClick={() =>
                                  updateUser(u.id, { role: u.role === "admin" ? "user" : "admin" })
                                }
                                className="p-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg transition disabled:opacity-40"
                                title={u.role === "admin" ? "Revoke admin" : "Make admin"}
                              >
                                <Crown className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!isSelf && (
                              <button
                                disabled={busy}
                                onClick={() => removeUser(u.id)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition disabled:opacity-40"
                                title="Remove account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
