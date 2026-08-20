"use client";

import React, { useState } from "react";
import { UserSession } from "@/types/dochub";
import {
  FileText,
  Loader2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Clock,
} from "lucide-react";

interface LoginViewProps {
  onLoginSuccess: (user: UserSession) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<"signin" | "signup">(() => {
    if (typeof window !== "undefined") {
      const hasSignedUp = localStorage.getItem("dochub_has_signed_up") === "true";
      const registeredList = localStorage.getItem("dochub_registered_emails");
      let hasEmails = false;
      if (registeredList) {
        try {
          const parsed = JSON.parse(registeredList);
          if (Array.isArray(parsed) && parsed.length > 0) hasEmails = true;
        } catch {}
      }
      return hasSignedUp || hasEmails ? "signin" : "signup";
    }
    return "signup";
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const getRegisteredEmails = (): string[] => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("dochub_registered_emails");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  };

  const addRegisteredEmail = (registeredEmail: string) => {
    if (typeof window === "undefined") return;
    try {
      const list = getRegisteredEmails();
      const clean = registeredEmail.toLowerCase().trim();
      if (!list.includes(clean)) {
        list.push(clean);
        localStorage.setItem("dochub_registered_emails", JSON.stringify(list));
      }
      localStorage.setItem("dochub_has_signed_up", "true");
    } catch {}
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setErrorMessage("");
    setInfoMessage("");

    const cleanEmail = email.toLowerCase().trim();

    if (authMode === "signup") {
      if (!name.trim()) {
        setErrorMessage("Please enter your full name");
        return;
      }
      if (password && confirmPassword && password !== confirmPassword) {
        setErrorMessage("Passwords do not match");
        return;
      }
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          name,
          password,
          company,
          isSignUp: authMode === "signup",
        }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (!data.success) {
        setErrorMessage(data.message || "Authentication failed");
        if (data.notSignedUp) {
          setTimeout(() => setAuthMode("signup"), 1500);
        } else if (data.alreadyExists) {
          setTimeout(() => setAuthMode("signin"), 1500);
        }
        return;
      }

      addRegisteredEmail(cleanEmail);

      if (data.pendingApproval) {
        setInfoMessage(data.message || "Account request submitted! Waiting for admin approval.");
        setAuthMode("signin");
        return;
      }

      if (data.user) {
        onLoginSuccess({
          id: data.user.id,
          name: data.user.name || name || cleanEmail.split("@")[0],
          email: data.user.email || cleanEmail,
          avatarUrl: data.user.avatarUrl,
          plan: data.user.plan || "Pro Enterprise",
          role: data.user.role || "user",
          isLoggedIn: true,
        });
      }
    } catch {
      setIsLoading(false);
      setErrorMessage("Unable to connect to server. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-slate-50 to-blue-50 flex flex-col items-center justify-center p-4 md:p-6 font-sans text-slate-900 antialiased selection:bg-sky-500 selection:text-white relative">
      {/* Background Subtle Sky Accent Circles */}
      <div className="absolute top-12 left-12 w-72 h-72 bg-sky-200/40 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-12 right-12 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-12 w-12 bg-sky-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/25 mb-3 border border-sky-400/40">
            <FileText className="w-6 h-6 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            DocHub
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            Enterprise PDF Management & E-Signatures
          </p>
        </div>

        {/* Minimal Sky Auth Card */}
        <div className="bg-white/90 backdrop-blur-xl border border-sky-100 rounded-3xl p-6 md:p-8 shadow-xl shadow-sky-900/5 space-y-6">
          {/* Segmented Control Switcher */}
          <div className="grid grid-cols-2 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/70 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setAuthMode("signin");
                setErrorMessage("");
                setInfoMessage("");
              }}
              className={`py-2 rounded-xl transition-all ${
                authMode === "signin"
                  ? "bg-white text-sky-600 shadow-sm font-bold border border-sky-100"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("signup");
                setErrorMessage("");
                setInfoMessage("");
              }}
              className={`py-2 rounded-xl transition-all ${
                authMode === "signup"
                  ? "bg-white text-sky-600 shadow-sm font-bold border border-sky-100"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Section Heading */}
          <div className="text-left">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {authMode === "signin" ? "Sign in to your account" : "Create a new account"}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {authMode === "signin"
                ? "Enter your email and password to access your dashboard"
                : "Register with your details to start managing documents"}
            </p>
          </div>

          {/* Alert Message Banner */}
          {errorMessage && (
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-amber-900 text-xs font-medium flex items-start gap-2.5 leading-relaxed text-left animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Info Message Banner (e.g. pending admin approval) */}
          {infoMessage && (
            <div className="p-3 bg-sky-50 border border-sky-200/80 rounded-2xl text-sky-900 text-xs font-medium flex items-start gap-2.5 leading-relaxed text-left animate-in fade-in">
              <Clock className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Form Inputs */}
          <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
            {/* Full Name Input (Sign Up) */}
            {authMode === "signup" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Full Name <span className="text-sky-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
                />
              </div>
            )}

            {/* Company Input (Sign Up) */}
            {authMode === "signup" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Company / Organization <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Inc."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
                />
              </div>
            )}

            {/* Email Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address <span className="text-sky-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
              />
            </div>

            {/* Password Input */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Password <span className="text-sky-500">*</span>
                </label>
                {authMode === "signin" && (
                  <button
                    type="button"
                    onClick={(e) => e.preventDefault()}
                    className="text-[11px] font-medium text-sky-600 hover:text-sky-700 transition"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
              />
            </div>

            {/* Confirm Password (Sign Up) */}
            {authMode === "signup" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm Password <span className="text-sky-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
                />
              </div>
            )}

            {/* Checkbox Options */}
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>
                  {authMode === "signin"
                    ? "Remember this device"
                    : "I agree to Terms of Service and Privacy Policy"}
                </span>
              </label>
            </div>

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={isLoading || !email}
              className="w-full mt-2 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold text-xs md:text-sm py-2.5 px-4 rounded-xl shadow-md shadow-sky-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>{authMode === "signin" ? "Sign in" : "Create account"}</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                </>
              )}
            </button>
          </form>

          {/* Toggle View Mode Link */}
          <div className="pt-2 text-center text-xs text-slate-500">
            {authMode === "signin" ? (
              <span>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setErrorMessage("");
                  }}
                  className="text-sky-600 hover:text-sky-700 font-semibold transition"
                >
                  Sign up
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setErrorMessage("");
                  }}
                  className="text-sky-600 hover:text-sky-700 font-semibold transition"
                >
                  Sign in
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Footer Subtext */}
        <div className="mt-6 flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> 256-bit Encrypted
          </span>
          <div className="flex gap-3">
            <a href="#terms" onClick={(e) => e.preventDefault()} className="hover:text-slate-600 transition">Terms</a>
            <span>•</span>
            <a href="#privacy" onClick={(e) => e.preventDefault()} className="hover:text-slate-600 transition">Privacy</a>
          </div>
        </div>
      </div>
    </div>
  );
};
