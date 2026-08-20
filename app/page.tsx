"use client";

import React, { useState, useEffect } from "react";
import { ActiveView, ActiveDocument, UserSession } from "@/types/dochub";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { DashboardView } from "@/components/DashboardView";
import { FileImportView } from "@/components/FileImportView";
import { PDFEditorView } from "@/components/PDFEditorView";
import { OnboardingModal } from "@/components/OnboardingModal";
import { SendDocumentModal } from "@/components/SendDocumentModal";
import { LoginView } from "@/components/LoginView";
import { CandidateSigningView } from "@/components/CandidateSigningView";
import { CompletedDocsView } from "@/components/CompletedDocsView";

export default function Home() {
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [isOpenMobileSidebar, setIsOpenMobileSidebar] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [candidateEmail, setCandidateEmail] = useState("candidate@email.com");

  // User Authentication Session State
  const [currentUserSession, setCurrentUserSession] = useState<UserSession | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("dochub_current_user");
      const isLoggedOut = localStorage.getItem("dochub_is_logged_out");
      
      if (savedUser && isLoggedOut !== "true") {
        try {
          setCurrentUserSession(JSON.parse(savedUser));
        } catch {
          setCurrentUserSession(null);
        }
      } else {
        setCurrentUserSession(null);
      }
      setIsAuthLoaded(true);
    }
  }, []);

  const handleUpdateSession = (user: UserSession | null) => {
    setCurrentUserSession(user);
    if (typeof window !== "undefined") {
      if (user) {
        localStorage.setItem("dochub_current_user", JSON.stringify(user));
        localStorage.setItem("dochub_is_logged_out", "false");
      } else {
        localStorage.removeItem("dochub_current_user");
        localStorage.setItem("dochub_is_logged_out", "true");
      }
    }
  };

  const [activeDocument, setActiveDocument] = useState<ActiveDocument | undefined>({
    id: "doc-default",
    name: "Commercial Lease Agreement 2026.pdf",
    size: "2.4 MB",
    pages: 1,
  });

  if (!isAuthLoaded) {
    return null;
  }

  // If user is logged out, render Login View
  if (!currentUserSession || !currentUserSession.isLoggedIn) {
    return (
      <LoginView
        onLoginSuccess={(user) => {
          handleUpdateSession(user);
          setActiveView("dashboard");
        }}
      />
    );
  }

  // If candidate signing portal is active
  if (activeView === "candidate_sign") {
    return (
      <CandidateSigningView
        documentData={activeDocument}
        userSession={currentUserSession}
        candidateEmail={candidateEmail}
        onBackToDashboard={() => setActiveView("dashboard")}
      />
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-100 flex flex-col font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenWalkthrough={() => setIsOnboardingOpen(true)}
        onToggleSidebar={() => setIsOpenMobileSidebar(!isOpenMobileSidebar)}
        userSession={currentUserSession}
        onLogout={() => handleUpdateSession(null)}
      />

      {/* Main Content Area + Fixed Sidebar */}
      <div className="flex flex-1 relative min-h-0">
        {/* Left Sidebar (Visible on Dashboard and File Import view) */}
        {activeView !== "editor" && (
          <Sidebar
            activeView={activeView}
            setActiveView={setActiveView}
            isOpenMobile={isOpenMobileSidebar}
            onCloseMobile={() => setIsOpenMobileSidebar(false)}
            userSession={currentUserSession}
            onLogout={() => handleUpdateSession(null)}
          />
        )}

        {/* View Routing Render */}
        <div
          className={`flex-1 flex flex-col min-h-0 transition-all duration-200 ${
            activeView !== "editor" ? "md:pl-64" : "pl-0"
          }`}
        >
          {activeView === "dashboard" && (
            <DashboardView
              setActiveView={setActiveView}
              onSelectDoc={(doc) => setActiveDocument(doc)}
              userSession={currentUserSession}
            />
          )}

          {activeView === "import" && (
            <FileImportView
              setActiveView={setActiveView}
              onImportComplete={(importedDoc) => {
                if (importedDoc) setActiveDocument(importedDoc);
                setActiveView("editor");
              }}
            />
          )}

          {activeView === "completed_docs" && (
            <CompletedDocsView
              setActiveView={setActiveView}
              onSelectDoc={(doc) => setActiveDocument(doc)}
              userSession={currentUserSession}
            />
          )}

          {activeView === "editor" && (
            <PDFEditorView
              setActiveView={setActiveView}
              onOpenWalkthrough={() => setIsOnboardingOpen(true)}
              onOpenSendModal={() => setIsSendModalOpen(true)}
              documentData={activeDocument}
            />
          )}
        </div>
      </div>

      {/* Onboarding Walkthrough Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onContinue={() => {
          setIsOnboardingOpen(false);
          setActiveView("editor");
        }}
      />

      {/* Send Document Modal */}
      <SendDocumentModal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        documentData={activeDocument}
        userSession={currentUserSession}
        onOpenCandidatePortal={(candEmail) => {
          setCandidateEmail(candEmail);
          setActiveView("candidate_sign");
        }}
      />
    </div>
  );
}
