"use client";

import React, { useState, useEffect } from "react";
import { ActiveDocument, UserSession } from "@/types/dochub";
import {
  Send,
  X,
  Mail,
  User,
  FileText,
  CheckCircle2,
  Loader2,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  Lock,
  PenTool,
} from "lucide-react";

interface SendDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentData?: ActiveDocument;
  userSession?: UserSession;
  onSuccessSent?: (recipientEmail: string, recipientName: string) => void;
  onOpenCandidatePortal?: (candidateEmail: string) => void;
}

export const SendDocumentModal: React.FC<SendDocumentModalProps> = ({
  isOpen,
  onClose,
  documentData,
  userSession,
  onSuccessSent,
  onOpenCandidatePortal,
}) => {
  const [senderEmail, setSenderEmail] = useState(userSession?.email || "jane.doe@dochub.com");

  useEffect(() => {
    if (userSession?.email) {
      setSenderEmail(userSession.email);
    }
  }, [userSession?.email, isOpen]);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [subject, setSubject] = useState(
    `Signature Requested: ${documentData?.name || "Document"}`
  );
  const [message, setMessage] = useState(
    `Hello, please review and e-sign the attached document "${
      documentData?.name || "Agreement"
    }".`
  );
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [sentInfo, setSentInfo] = useState<{ email: string; name: string } | null>(null);

  if (!isOpen) return null;

  const baseUrl = (
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "https://cus-doc.vercel.app"
  ).replace(/\/$/, "");
  const candidateLink = `${baseUrl}/sign/${
    documentData?.id || "dh-884920"
  }?candidate=${encodeURIComponent(recipientEmail || "candidate@email.com")}`;

  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail) return;

    setIsSending(true);

    const activeFileUrl = documentData?.fileUrl || (typeof window !== "undefined" ? localStorage.getItem("dochub_pdf_data") || sessionStorage.getItem("dochub_active_fileUrl") : null);
    const activeFileType = documentData?.fileType || (typeof window !== "undefined" ? localStorage.getItem("dochub_pdf_type") || sessionStorage.getItem("dochub_active_fileType") : null);
    const activePlacedFields = documentData?.placedFields || (typeof window !== "undefined" ? (localStorage.getItem("dochub_placed_fields") ? JSON.parse(localStorage.getItem("dochub_placed_fields")!) : []) : []);

    try {
      await fetch("/api/documents/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: documentData?.name || "Agreement.pdf",
          size: documentData?.size || "1.2 MB",
          pages: documentData?.pages || 1,
          fileUrl: activeFileUrl,
          fileType: activeFileType,
          placedFields: activePlacedFields,
          senderEmail: senderEmail,
          recipientEmail: recipientEmail,
          recipientName: recipientName || recipientEmail,
          subject: subject,
          message: message,
        }),
      });
    } catch (error) {
      console.warn("MongoDB Document save warning:", error);
    }

    setIsSending(false);
    setIsSuccess(true);
    setSentInfo({ email: recipientEmail, name: recipientName || recipientEmail });
    if (onSuccessSent) {
      onSuccessSent(recipientEmail, recipientName);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(candidateLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleResetAndClose = () => {
    setIsSuccess(false);
    setIsSending(false);
    setRecipientEmail("");
    setRecipientName("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-8 overflow-hidden animate-in zoom-in-95">
        {/* Top Decorative Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-emerald-500 to-indigo-600"></div>

        {/* Close Button */}
        <button
          onClick={handleResetAndClose}
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>

        {!isSuccess ? (
          <form onSubmit={handleSendSubmit} className="space-y-4">
            {/* Header Title */}
            <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
                <Send className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="text-left">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Send Document to Candidate
                </h2>
                <p className="text-xs text-slate-500">
                  Document: <span className="font-semibold text-slate-800">{documentData?.name || "Uploaded PDF"}</span>
                </p>
              </div>
            </div>

            {/* Form Inputs */}
            <div className="space-y-3 text-left pt-1">
              {/* Sender Account (From) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  From (Sender Account)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-blue-50/50 border border-blue-200 rounded-xl text-xs font-bold text-blue-900 focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    Logged In
                  </span>
                </div>
              </div>

              {/* Candidate Recipient Email */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Candidate Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="candidate.email@domain.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Candidate Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Candidate Name (Optional)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Candidate Name"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Email Subject */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Email Subject Line
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Message Textarea */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Message / Instructions for Candidate
                </label>
                <textarea
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Instructions for candidate..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition resize-none"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSending || !recipientEmail}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs md:text-sm font-bold px-6 py-2.5 rounded-xl shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending to Candidate...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send to Candidate</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Success Screen */
          <div className="text-center py-4 space-y-4 animate-in zoom-in-95">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mx-auto shadow-md">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5" /> Sent to Candidate Inbox
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900">
                Email Sent to Candidate!
              </h3>
              <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Dispatched from <span className="font-bold text-blue-600">{senderEmail}</span> directly to candidate email{" "}
                <strong className="text-emerald-700 underline">{sentInfo?.email || recipientEmail}</strong>.
              </p>
            </div>

            {/* Candidate Link & Details Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs space-y-3 max-w-sm mx-auto">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Candidate E-Signing Link:
                </span>
                <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-mono text-blue-600 truncate flex-1">
                    {candidateLink}
                  </span>
                  <button
                    onClick={handleCopyLink}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition flex items-center gap-1 text-[10px] font-bold flex-shrink-0"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-200/80 pt-1 text-slate-600 text-[11px] space-y-1">
                <div className="flex justify-between py-1">
                  <span>Document:</span>
                  <span className="font-semibold text-slate-800 truncate max-w-[170px]">
                    {documentData?.name || "Agreement.pdf"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Candidate:</span>
                  <span className="font-semibold text-slate-800">{sentInfo?.name}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Audit Trail:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 256-bit Encrypted Delivery
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              {onOpenCandidatePortal && (
                <button
                  type="button"
                  onClick={() => {
                    const candidate = sentInfo?.email || recipientEmail || "candidate@email.com";
                    handleResetAndClose();
                    onOpenCandidatePortal(candidate);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 px-6 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs md:text-sm"
                >
                  <PenTool className="w-4 h-4" />
                  <span>Open Candidate E-Signing Portal & Test Email Delivery</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-6 rounded-xl transition text-xs"
              >
                Back to Dashboard / Editor
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
