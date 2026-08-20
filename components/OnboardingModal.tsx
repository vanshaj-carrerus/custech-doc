"use client";

import React from "react";
import {
  FileText,
  Edit3,
  ShieldCheck,
  Share2,
  PenTool,
  X,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onContinue,
}) => {
  if (!isOpen) return null;

  const features = [
    {
      icon: Edit3,
      title: "Edit",
      emoji: "✏️",
      description: "Modify PDFs, insert text, shapes, images, and annotations effortlessly.",
      color: "bg-blue-50 text-blue-600 border-blue-100",
    },
    {
      icon: ShieldCheck,
      title: "Secure",
      emoji: "🔒",
      description: "Bank-grade 256-bit encryption, comprehensive audit trails, and permissions.",
      color: "bg-emerald-50 text-emerald-600 border-emerald-100",
    },
    {
      icon: Share2,
      title: "Share",
      emoji: "📤",
      description: "Send documents securely via web link, encrypted email, or direct fax.",
      color: "bg-purple-50 text-purple-600 border-purple-100",
    },
    {
      icon: PenTool,
      title: "E-Sign",
      emoji: "✍️",
      description: "Collect legally binding e-signatures from multiple signers in minutes.",
      color: "bg-amber-50 text-amber-600 border-amber-100",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-8 overflow-hidden animate-in zoom-in-95">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Badge & Title */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20 mb-3">
            <FileText className="w-7 h-7" />
          </div>
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Quick Tour
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Welcome to CUS-DOC!
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-xs">
            Everything you need to edit, sign, and manage PDFs in one place.
          </p>
        </div>

        {/* Feature List */}
        <div className="grid grid-cols-1 gap-3 mb-8">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-sm hover:border-slate-200 transition"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl font-semibold flex-shrink-0 border ${feature.color}`}
                >
                  <span className="text-lg">{feature.emoji}</span>
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    {feature.title}
                  </h4>
                  <p className="text-xs text-slate-500 leading-snug">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Footer: Skip / Continue */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition"
          >
            Skip
          </button>
          <button
            onClick={onContinue}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs md:text-sm font-bold px-6 py-2.5 rounded-xl shadow-md shadow-blue-600/30 transition-all transform hover:-translate-y-0.5"
          >
            <span>Continue</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
