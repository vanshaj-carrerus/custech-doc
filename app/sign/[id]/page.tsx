"use client";

import React, { use, useState, useEffect } from "react";
import { CandidateSigningView } from "@/components/CandidateSigningView";
import { ActiveDocument, UserSession } from "@/types/dochub";

interface SignPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ candidate?: string }>;
}

export default function CandidateSignPage({ params, searchParams }: SignPageProps) {
  const unwrappedParams = use(params);
  const unwrappedSearchParams = use(searchParams);

  const docId = unwrappedParams.id;
  const candidateEmail = unwrappedSearchParams.candidate || "candidate@email.com";

  const [documentData, setDocumentData] = useState<ActiveDocument>({
    id: docId,
    name: "Commercial Lease Agreement 2026.pdf",
    size: "2.4 MB",
    pages: 14,
  });

  useEffect(() => {
    // Optionally fetch document from MongoDB API by ID
    fetch(`/api/documents/list?id=${encodeURIComponent(docId)}`)
      .then((res) => res.json())
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
            });
          }
        }
      })
      .catch((err) => console.warn("Doc fetch warning:", err));
  }, [docId]);

  const defaultUserSession: UserSession = {
    id: "usr-recruiter",
    name: "Recruiter Workspace",
    email: "jane.doe@dochub.com",
    plan: "Pro Enterprise",
    isLoggedIn: true,
  };

  return (
    <CandidateSigningView
      documentData={documentData}
      userSession={defaultUserSession}
      candidateEmail={candidateEmail}
      onBackToDashboard={() => {
        window.location.href = "/";
      }}
    />
  );
}
