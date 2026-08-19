"use client";

import React, { useState, useEffect } from "react";
import { ActiveView, RecentDoc, ActiveDocument, UserSession } from "@/types/dochub";
import {
  CheckCircle2,
  FileText,
  Clock,
  Eye,
  Download,
  Search,
  ShieldCheck,
  Calendar,
  UserCheck,
  Plus,
  ArrowRight,
} from "lucide-react";

interface CompletedDocsViewProps {
  setActiveView: (view: ActiveView) => void;
  onSelectDoc?: (doc: ActiveDocument) => void;
  userSession?: UserSession;
}

export const CompletedDocsView: React.FC<CompletedDocsViewProps> = ({
  setActiveView,
  onSelectDoc,
  userSession,
}) => {
  const [completedDocs, setCompletedDocs] = useState<RecentDoc[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const userEmail = userSession?.email?.toLowerCase();

  useEffect(() => {
    if (!userEmail) {
      setIsLoading(false);
      return;
    }

    fetch(`/api/documents/list?email=${encodeURIComponent(userEmail)}`)
      .then((res) => res.json())
      .then((data) => {
        setIsLoading(false);
        if (data.success && data.documents) {
          const finished = data.documents.filter((d: any) => d.status === "Completed");
          setCompletedDocs(finished);
        }
      })
      .catch((err) => {
        setIsLoading(false);
        console.warn("MongoDB fetch error:", err);
      });

    // Check localStorage scoped completed documents
    if (typeof window !== "undefined") {
      const savedCompleted = localStorage.getItem(`dochub_completed_${userEmail}`);
      if (savedCompleted) {
        try {
          const docName =
            localStorage.getItem(`dochub_pdf_name_${userEmail}`) ||
            "Commercial Lease Agreement 2026.pdf";
          setCompletedDocs((prev) => {
            const exists = prev.some((d) => d.title === docName);
            if (!exists) {
              return [
                {
                  id: `doc-comp-${Date.now()}`,
                  title: docName,
                  updatedAt: "Just now",
                  pages: 6,
                  status: "Completed",
                  size: "1.2 MB",
                },
                ...prev,
              ];
            }
            return prev;
          });
        } catch {}
      }
    }
  }, [userEmail]);

  const sampleCompleted: RecentDoc[] = completedDocs;

  const filteredDocs = sampleCompleted.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 bg-slate-50 min-h-[calc(100vh-64px)] p-4 md:p-8 lg:p-12 overflow-y-auto font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-emerald-100 text-emerald-700 rounded-2xl border border-emerald-200 flex-shrink-0 shadow-2xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-extrabold text-slate-900">
                  Completed & Executed Agreements
                </h1>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-300">
                  {filteredDocs.length} Total
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 max-w-lg">
                View all candidate-signed legal contracts, executed NDAs, and audit-verified agreements.
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveView("import")}
            className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs md:text-sm px-5 py-3 rounded-xl shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 flex-shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Send New Request</span>
          </button>
        </div>

        {/* Search & Audit Banner Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search completed documents by title..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0">
            <ShieldCheck className="w-4 h-4" />
            <span>256-Bit SSL Tamper-Proof Audit</span>
          </div>
        </div>

        {/* Completed Documents Table Container */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Executed Document Title</span>
            <span>Status & Actions</span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredDocs.length > 0 ? (
              filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-5 hover:bg-slate-50/90 transition cursor-pointer group"
                  onClick={() => {
                    if (onSelectDoc) {
                      onSelectDoc({
                        id: doc.id,
                        name: doc.title,
                        size: doc.size,
                        pages: doc.pages,
                        status: "Completed",
                        fileUrl: doc.fileUrl,
                        fileType: doc.fileType,
                        placedFields: doc.placedFields,
                        filledFields: doc.filledFields || doc.placedFields,
                      });
                    }
                    setActiveView("editor");
                  }}
                >
                  {/* Left Title & Info */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200 flex-shrink-0 group-hover:scale-105 transition-transform">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 text-left">
                      <h3 className="text-sm md:text-base font-extrabold text-slate-900 truncate group-hover:text-emerald-600 transition-colors">
                        {doc.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs text-slate-400 mt-1 font-medium">
                        <span>{doc.pages} pages</span>
                        <span>•</span>
                        <span>{doc.size}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> Signed {doc.updatedAt}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions & Badge */}
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                      <span>Completed</span>
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectDoc) {
                          onSelectDoc({
                            id: doc.id,
                            name: doc.title,
                            size: doc.size,
                            pages: doc.pages,
                            status: "Completed",
                            fileUrl: doc.fileUrl,
                            fileType: doc.fileType,
                            placedFields: doc.placedFields,
                            filledFields: doc.filledFields || doc.placedFields,
                          });
                        }
                        setActiveView("editor");
                      }}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-extrabold transition flex items-center gap-1 border border-blue-200"
                      title="View Signed PDF"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View PDF</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.print();
                      }}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                      title="Download / Print Executed Agreement"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-600">
                  No completed documents matching your search.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
