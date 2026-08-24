"use client";

import React, { useEffect, useRef, useState } from "react";
import { UserSession } from "@/types/dochub";
import {
  X,
  Settings,
  User,
  Mail,
  Camera,
  Loader2,
  AlertTriangle,
  Check,
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userSession?: UserSession;
  onUpdateSession: (user: UserSession) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  userSession,
  onUpdateSession,
}) => {
  const [name, setName] = useState(userSession?.name || "");
  const [email, setEmail] = useState(userSession?.email || "");
  const [avatarUrl, setAvatarUrl] = useState(userSession?.avatarUrl || "");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wasOpenRef = useRef(false);
  useEffect(() => {
    // Only repopulate the form when the modal transitions from closed to
    // open — re-running this on every userSession change would wipe out the
    // "saved" confirmation right after a successful save updates the session.
    if (isOpen && !wasOpenRef.current) {
      setName(userSession?.name || "");
      setEmail(userSession?.email || "");
      setAvatarUrl(userSession?.avatarUrl || "");
      setErrorMessage("");
      setIsSaved(false);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, userSession]);

  if (!isOpen) return null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSession?.email) return;
    setIsSaving(true);
    setErrorMessage("");
    setIsSaved(false);

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentEmail: userSession.email,
          name,
          email,
          avatarUrl,
        }),
      });
      const data = await res.json();
      setIsSaving(false);

      if (!data.success) {
        setErrorMessage(data.message || "Could not save changes");
        return;
      }

      onUpdateSession({
        ...userSession,
        name: data.user.name,
        email: data.user.email,
        avatarUrl: data.user.avatarUrl,
      });
      setIsSaved(true);
    } catch {
      setIsSaving(false);
      setErrorMessage("Unable to connect to server. Please try again.");
    }
  };

  const initials = name ? name.slice(0, 2).toUpperCase() : "U";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-8 overflow-hidden animate-in zoom-in-95">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-sky-600 via-blue-500 to-indigo-600"></div>

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
            <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl border border-sky-100">
              <Settings className="w-6 h-6 stroke-[2]" />
            </div>
            <div className="text-left">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Account Settings
              </h2>
              <p className="text-xs text-slate-500">Update your profile details</p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-amber-900 text-xs font-medium flex items-start gap-2.5 text-left">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isSaved && (
            <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-emerald-800 text-xs font-medium flex items-start gap-2.5 text-left">
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>Profile updated successfully.</span>
            </div>
          )}

          {/* Profile Photo */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-sky-500/20"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xl ring-2 ring-sky-500/20">
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-full shadow-sm transition"
                title="Change profile photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                className="hidden"
              />
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Click the camera to change your photo</span>
          </div>

          <div className="space-y-3 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md shadow-sky-500/25 transition disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
