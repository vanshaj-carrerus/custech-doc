"use client";

import React, { useState } from "react";
import { UserSession } from "@/types/dochub";
import {
  FileText,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Sparkles,
  Zap,
  User,
  Building,
  UserPlus,
  KeyRound,
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

    const cleanEmail = email.toLowerCase().trim();

    if (authMode === "signup") {
      if (!name.trim()) {
        setErrorMessage("Please enter your full name to sign up!");
        return;
      }
      if (password && confirmPassword && password !== confirmPassword) {
        setErrorMessage("Passwords do not match! Please check your password entry.");
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
          setTimeout(() => setAuthMode("signup"), 1600);
        } else if (data.alreadyExists) {
          setTimeout(() => setAuthMode("signin"), 1600);
        }
        return;
      }

      // Record in registered emails list
      addRegisteredEmail(cleanEmail);

      if (data.user) {
        onLoginSuccess({
          id: data.user.id,
          name: data.user.name || name || cleanEmail.split("@")[0],
          email: data.user.email || cleanEmail,
          avatarUrl: data.user.avatarUrl,
          plan: data.user.plan || "Pro Enterprise",
          isLoggedIn: true,
        });
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage("Authentication server error. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 md:p-8 relative overflow-hidden font-sans">
      {/* Background Glow Accents */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/30 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10 border border-slate-800/50">
        {/* Left Side: Brand Hero Banner */}
        <div className="lg:col-span-5 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 p-8 md:p-10 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-600 font-extrabold shadow-md">
                <FileText className="w-6 h-6" />
              </div>
              <span className="text-2xl font-black tracking-tight text-white">
                DocHub
              </span>
            </div>

            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-blue-200 text-xs font-bold border border-white/10">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Enterprise Workspace
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold leading-tight tracking-tight">
                {authMode === "signin"
                  ? "Secure Document Management & E-Sign Portal"
                  : "Create Your Enterprise E-Sign Account"}
              </h1>
              <p className="text-xs md:text-sm text-blue-100/90 leading-relaxed">
                {authMode === "signin"
                  ? "Sign in to your DocHub workspace to manage agreements, edit PDFs, and send sign requests."
                  : "Sign up today to start uploading PDFs, creating e-signature fields, and tracking candidate approvals."}
              </p>
            </div>
          </div>

          {/* Key Feature Badges */}
          <div className="relative z-10 space-y-3 pt-8 border-t border-white/15">
            <div className="flex items-center gap-2.5 text-xs text-blue-100 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Bank-Grade 256-bit SSL Encryption</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-blue-100 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Real-Time Candidate E-Sign Tracking</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-blue-100 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Instant PDF Document Processing</span>
            </div>
          </div>
        </div>

        {/* Right Side: Sign In / Sign Up Form */}
        <div className="lg:col-span-7 bg-white p-8 md:p-12 flex flex-col justify-between text-left">
          <div>
            {/* Top Switcher Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 mb-6">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signin");
                  setErrorMessage("");
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                  authMode === "signin"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Sign In 🔑</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signup");
                  setErrorMessage("");
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                  authMode === "signup"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Sign Up / Create Account 🚀</span>
              </button>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {authMode === "signin" ? "Dashboard Sign In" : "Register New Account"}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {authMode === "signin"
                    ? "Enter your email & password to access your dashboard"
                    : "Fill in your details to create a free DocHub account"}
                </p>
              </div>
            </div>

            {/* Error banner if any */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
                <span>⚠️ {errorMessage}</span>
              </div>
            )}



            {/* Auth Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Full Name Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name {authMode === "signup" && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required={authMode === "signup"}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Company Input (Only on Sign Up) */}
              {authMode === "signup" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Company / Organization Name
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Acme Inc."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    />
                  </div>
                </div>
              )}

              {/* Email Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Password <span className="text-red-500">*</span>
                  </label>
                  {authMode === "signin" && (
                    <a
                      href="#forgot"
                      onClick={(e) => e.preventDefault()}
                      className="text-[11px] font-semibold text-blue-600 hover:underline"
                    >
                      Forgot Password?
                    </a>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Confirm Password (Only on Sign Up) */}
              {authMode === "signup" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    />
                  </div>
                </div>
              )}

              {/* Remember Me / Terms Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span className="text-xs text-slate-600 font-medium">
                    {authMode === "signin"
                      ? "Keep me signed in on this device"
                      : "I agree to Terms of Service & Privacy Policy"}
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 px-6 rounded-xl shadow-md shadow-blue-600/30 transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{authMode === "signin" ? "Signing In..." : "Creating Account..."}</span>
                  </>
                ) : (
                  <>
                    <span>
                      {authMode === "signin" ? "Sign In to Dashboard" : "Create Account & Start"}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Toggle Mode Link */}
            <div className="mt-4 text-center">
              {authMode === "signin" ? (
                <p className="text-xs text-slate-500">
                  Don't have an account yet?{" "}
                  <button
                    onClick={() => {
                      setAuthMode("signup");
                      setErrorMessage("");
                    }}
                    className="font-bold text-blue-600 hover:underline"
                  >
                    Sign Up Free
                  </button>
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Already have an account?{" "}
                  <button
                    onClick={() => {
                      setAuthMode("signin");
                      setErrorMessage("");
                    }}
                    className="font-bold text-blue-600 hover:underline"
                  >
                    Sign In Here
                  </button>
                </p>
              )}
            </div>
          </div>

          {/* Footer security note */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Protected by DocHub Auth v2.4
            </span>
            <span>Terms & Privacy</span>
          </div>
        </div>
      </div>
    </div>
  );
};
