"use client";

import React, { use, useState, useEffect } from "react";
import { CandidateSigningView } from "@/components/CandidateSigningView";
import { ActiveDocument, UserSession } from "@/types/dochub";
import { FileText, Loader2 } from "lucide-react";

interface SignPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ candidate?: string }>;
}

export default function CandidateSignPage({ params, searchParams }: SignPageProps) {
  const unwrappedParams = use(params);
  const unwrappedSearchParams = use(searchParams);

  const docId = unwrappedParams.id;
  const candidateEmail = unwrappedSearchParams.candidate || "candidate@email.com";

  const [documentData, setDocumentData] = useState<ActiveDocument>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Falls back to a placeholder only when the document lookup fails (e.g. no DB
  // connection) — otherwise this is replaced with the real sender's email below.
  const [recruiterEmail, setRecruiterEmail] = useState<string | null>(null);

  useEffect(() => {
    // Optionally fetch document from MongoDB API by ID
    fetch(`/api/documents?id=${encodeURIComponent(docId)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Document could not be loaded");
        return data;
      })
      .then((data) => {
        if (data.success && data.documents && data.documents.length > 0) {
          const found = data.documents[0];
          if (found) {
            setDocumentData({
              id: found.id,
              name: found.title,
              size: found.size || "1.2 MB",
              pages: found.pages || 1,
              fileUrl: found.fileUrl,
              fileType: found.fileType,
              placedFields: found.placedFields,
              filledFields: found.filledFields,
              status: found.status,
              recipientEmail: found.recipientEmail,
              recipientName: found.recipientName,
            });
            if (found.senderEmail) {
              setRecruiterEmail(found.senderEmail);
            }
          }
        } else {
          setLoadError("Document not found");
        }
      })
      .catch((err) => {
        console.warn("Doc fetch warning:", err);
        setLoadError(err instanceof Error ? err.message : "Document could not be loaded");
      })
      .finally(() => setIsLoading(false));

    fetch(`/api/documents/track/${encodeURIComponent(docId)}?event=view`).catch(() => {});
  }, [docId]);

  const userSession: UserSession = {
    id: "usr-recruiter",
    name: "Recruiter Workspace",
    email: recruiterEmail || "jane.doe@dochub.com",
    plan: "Pro Enterprise",
    isLoggedIn: true,
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary/5 p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-bold text-slate-700">Loading your document...</p>
        </div>
      </div>
    );
  }

  if (!documentData || loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary/5 p-6">
        <div className="max-w-sm rounded-2xl border border-primary/20 bg-white p-6 text-center shadow-lg">
          <FileText className="mx-auto mb-3 h-9 w-9 text-primary" />
          <h1 className="font-bold text-slate-900">Document unavailable</h1>
          <p className="mt-1 text-sm text-slate-500">
            {loadError || "This document could not be loaded."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <CandidateSigningView
      documentData={documentData}
      userSession={userSession}
      candidateEmail={candidateEmail}
      standalone
      onBackToDashboard={() => {
        window.location.href = "/";
      }}
    />
  );
}
