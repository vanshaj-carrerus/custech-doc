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
  onSuccessSent?: (payload: {
    recipientEmail: string;
    recipientName: string;
    documentId?: string;
  }) => void;
  onOpenCandidatePortal?: (candidateEmail: string) => void;
  onCreateNewDocument?: () => void;
}

export const SendDocumentModal: React.FC<SendDocumentModalProps> = ({
  isOpen,
  onClose,
  documentData,
  userSession,
  onSuccessSent,
  onOpenCandidatePortal,
  onCreateNewDocument,
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
  const [alreadySentTo, setAlreadySentTo] = useState<string | null>(
    documentData?.status === "Pending Sign" || documentData?.status === "Completed"
      ? documentData.recipientEmail || "a candidate"
      : documentData?.recipientEmail || null
  );
  const [sendError, setSendError] = useState("");
  const [sentSigningUrl, setSentSigningUrl] = useState("");
  const [sentDocumentId, setSentDocumentId] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (isSuccess) return;
    const locked =
      documentData?.status === "Pending Sign" ||
      documentData?.status === "Completed" ||
      !!documentData?.recipientEmail;
    setAlreadySentTo(locked ? documentData?.recipientEmail || "a candidate" : null);
    setSendError("");
  }, [isOpen, isSuccess, documentData?.id, documentData?.status, documentData?.recipientEmail]);

  if (!isOpen) return null;

  const baseUrl = (
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "https://cus-doc.vercel.app"
  ).replace(/\/$/, "");
  const candidateLink = sentSigningUrl;

  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail) return;

    const activeFileUrl =
      documentData?.fileUrl ||
      (typeof window !== "undefined"
        ? localStorage.getItem("dochub_pdf_data") ||
          sessionStorage.getItem("dochub_active_fileUrl")
        : null);
    const activeFileType =
      documentData?.fileType ||
      (typeof window !== "undefined"
        ? localStorage.getItem("dochub_pdf_type") ||
          sessionStorage.getItem("dochub_active_fileType")
        : null);
    const activePlacedFields =
      documentData?.placedFields ||
      (typeof window !== "undefined" && localStorage.getItem("dochub_placed_fields")
        ? JSON.parse(localStorage.getItem("dochub_placed_fields")!)
        : []);

    if (!activeFileUrl) {
      setSendError("The document file is missing. Upload the file again, then send it.");
      return;
    }

    setIsSending(true);
    setSendError("");

    try {
      const draftRes = await fetch("/api/documents/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: documentData?.id,
          name: documentData?.name || "Agreement.pdf",
          size: documentData?.size || "1.2 MB",
          pages: documentData?.pages || 1,
          senderEmail,
          fileType: activeFileType,
          placedFields: activePlacedFields,
        }),
      });
      const draftData = await draftRes.json();
      const savedId = draftData.document?.id || "";
      if (!draftRes.ok || !draftData.success || !/^[a-fA-F0-9]{24}$/.test(savedId)) {
        throw new Error(draftData.message || "Could not prepare this document");
      }

      const comma = activeFileUrl.indexOf(",");
      const mime =
        activeFileUrl.startsWith("data:") && activeFileUrl.includes(";")
          ? activeFileUrl.slice(5, activeFileUrl.indexOf(";"))
          : activeFileType || "application/pdf";
      const base64 =
        activeFileUrl.startsWith("data:") && comma !== -1
          ? activeFileUrl.slice(comma + 1)
          : activeFileUrl;
      const chunkSize = 700000;
      const total = Math.max(1, Math.ceil(base64.length / chunkSize));
      for (let index = 0; index < total; index++) {
        const chunkRes = await fetch(`/api/documents/${savedId}/chunks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            index,
            total,
            data: base64.slice(index * chunkSize, (index + 1) * chunkSize),
            mimeType: mime,
          }),
        });
        const chunkData = await chunkRes.json();
        if (!chunkRes.ok || !chunkData.success) {
          throw new Error(chunkData.message || "Could not upload the document file");
        }
      }

      const res = await fetch("/api/documents/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: savedId,
          name: documentData?.name || "Agreement.pdf",
          size: documentData?.size || "1.2 MB",
          pages: documentData?.pages || 1,
          fileType: activeFileType,
          placedFields: activePlacedFields,
          senderEmail: senderEmail,
          recipientEmail: recipientEmail,
          recipientName: recipientName || recipientEmail,
          subject: subject,
          message: message,
        }),
      });
      const data = await res.json();

      if (data.alreadySent) {
        setAlreadySentTo(data.recipientEmail || "a candidate");
        setIsSending(false);
        return;
      }

      if (!res.ok && !data.success) {
        setSendError(data.message || "Could not send this document. Please try again.");
        setIsSending(false);
        return;
      }

      const sentId = data.document?.id || savedId;
      if (!/^[a-fA-F0-9]{24}$/.test(sentId) || !data.signingUrl) {
        setSendError("The document was not saved correctly. Please upload it again and send.");
        setIsSending(false);
        return;
      }

      setIsSending(false);
      setIsSuccess(true);
      setSentDocumentId(sentId);
      setSentSigningUrl(data.signingUrl);
      setSentInfo({ email: recipientEmail, name: recipientName || recipientEmail });
      if (onSuccessSent) {
        onSuccessSent({
          recipientEmail,
          recipientName: recipientName || recipientEmail,
          documentId: sentId,
        });
      }
    } catch (error) {
      console.warn("Document send failed:", error);
      setSendError(
        error instanceof Error ? error.message : "Could not send this document. Please try again."
      );
      setIsSending(false);
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
    setSendError("");
    setSentSigningUrl("");
    setSentDocumentId("");
    onClose();
  };

  const handleCreateNewDocument = () => {
    handleResetAndClose();
    onCreateNewDocument?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-8 animate-in zoom-in-95">
        {/* Top Decorative Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-emerald-500 to-indigo-600"></div>

        {/* Close Button */}
        <button
          onClick={handleResetAndClose}
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>

        {alreadySentTo ? (
          <div className="text-center py-4 space-y-4 animate-in zoom-in-95">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 mx-auto shadow-md">
              <Lock className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold mb-2">
                <Lock className="w-3.5 h-3.5" /> Already sent
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900">
                This document is locked
              </h3>
              <p className="text-xs md:text-sm text-slate-500 mt-2 max-w-sm mx-auto">
                It was already emailed to{" "}
                <strong className="text-primary underline">{alreadySentTo}</strong>.
                You cannot send the same document to anyone else.
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs max-w-sm mx-auto">
              <p className="text-slate-600 leading-relaxed">
                To send this file to another candidate, upload it again as a{" "}
                <span className="font-bold text-slate-900">new document</span>. Each send is unique to one person.
              </p>
            </div>
            <div className="pt-1 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleCreateNewDocument}
                className="w-full bg-primary hover:bg-primary/90 text-white font-extrabold py-3 px-6 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs md:text-sm"
              >
                <FileText className="w-4 h-4" />
                <span>Upload a New Document</span>
              </button>
              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-6 rounded-xl transition text-xs"
              >
                Back
              </button>
            </div>
          </div>
        ) : !isSuccess ? (
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
                  {" · "}
                  <span className="text-amber-700 font-semibold">One candidate only — upload a new file to send to someone else.</span>
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
                  Send To Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="Enter any email address"
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

            {sendError && (
              <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {sendError}
              </p>
            )}

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
                className="flex items-center gap-2 bg-secondary hover:bg-secondary/90 active:bg-secondary text-white text-xs md:text-sm font-bold px-6 py-2.5 rounded-xl shadow-md shadow-secondary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
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
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-3 max-w-sm mx-auto flex items-start gap-2 text-left">
                <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  This document is now locked to this candidate. To send the file to someone else, upload it as a new document.
                </span>
              </p>
              <p className="text-[11px] text-primary bg-sky-50 border border-sky-100 rounded-xl px-3 py-2 mt-2 max-w-sm mx-auto text-left">
                Watch the dashboard — it updates when they open the email or click the sign link.
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
              {onCreateNewDocument && (
                <button
                  type="button"
                  onClick={handleCreateNewDocument}
                  className="w-full text-primary hover:text-primary/80 font-bold py-1 text-xs"
                >
                  Upload a new document to send to someone else
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
