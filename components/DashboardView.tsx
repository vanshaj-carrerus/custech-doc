"use client";

import React, { useState, useEffect } from "react";
import { ActiveView, RecentDoc, ActiveDocument, UserSession } from "@/types/dochub";
import {
  UploadCloud,
  PenTool,
  ChevronRight,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Eye,
  Plus,
} from "lucide-react";

interface DashboardViewProps {
  setActiveView: (view: ActiveView) => void;
  onSelectDoc?: (doc: ActiveDocument) => void;
  userSession?: UserSession;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  setActiveView,
  onSelectDoc,
  userSession,
}) => {
  const [mongoDocs, setMongoDocs] = useState<RecentDoc[]>([]);
  const [filterTab, setFilterTab] = useState<"all" | "completed" | "pending">("all");

  const userEmail = userSession?.email?.toLowerCase();
  const userName = userSession?.name || "User";

  useEffect(() => {
    if (!userEmail) return;

    fetch(`/api/documents/list?email=${encodeURIComponent(userEmail)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.documents) {
          setMongoDocs(data.documents);
        }
      })
      .catch((err) => console.warn("MongoDB fetch notice:", err));

    if (typeof window !== "undefined") {
      const savedCompleted = localStorage.getItem(`dochub_completed_${userEmail}`);
      if (savedCompleted) {
        try {
          const docName =
            localStorage.getItem(`dochub_pdf_name_${userEmail}`) ||
            "Commercial Lease Agreement 2026.pdf";
          setMongoDocs((prev) => {
            const exists = prev.some((d) => d.title === docName);
            if (!exists) {
              return [
                {
                  id: `doc-comp-${Date.now()}`,
                  title: docName,
                  updatedAt: "Just now",
                  pages: 1,
                  status: "Completed",
                  size: "1.2 MB",
                },
                ...prev,
              ];
            }
            return prev.map((d) => (d.title === docName ? { ...d, status: "Completed" } : d));
          });
        } catch {}
      }
    }
  }, [userEmail]);

  const defaultDocs: RecentDoc[] = mongoDocs;

  const filteredDocs = defaultDocs.filter((doc) => {
    if (filterTab === "completed") return doc.status === "Completed";
    if (filterTab === "pending") return doc.status === "Pending" || doc.status === "Pending Sign";
    return true;
  });

  const completedCount = defaultDocs.filter((d) => d.status === "Completed").length;

  return (
    <div className="flex-1 bg-slate-50/60 min-h-[calc(100vh-64px)] p-4 md:p-8 lg:p-10 overflow-y-auto font-sans text-slate-900">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Title Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-b border-slate-200/60 pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-semibold border border-sky-200/60 mb-2">
              <span>Workspace Overview</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              DocHub Workspace
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-xl">
              Import, edit, sign, and manage legal agreements, NDAs, and PDF documents in one central hub.
            </p>
          </div>

          <button
            onClick={() => setActiveView("import")}
            className="self-start md:self-auto flex items-center gap-2 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold text-xs md:text-sm px-4 py-2.5 rounded-xl shadow-sm shadow-sky-500/20 transition-all transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Upload Document</span>
          </button>
        </div>

        {/* Quick Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          {/* Card 1: Import Document */}
          <div
            onClick={() => setActiveView("import")}
            className="group flex flex-col justify-between p-5 bg-white hover:bg-sky-50/30 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-sky-300 transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                <UploadCloud className="w-5 h-5 stroke-[2]" />
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors mb-1">
                Import Document
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Upload PDF, DOCX, or image files to edit or place form fields.
              </p>
            </div>
          </div>

          {/* Card 2: Completed Documents */}
          <div
            onClick={() => setFilterTab("completed")}
            className="group flex flex-col justify-between p-5 bg-white hover:bg-purple-50/30 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-purple-300 transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <CheckCircle2 className="w-5 h-5 stroke-[2]" />
              </div>
              <span className="bg-purple-50 text-purple-700 border border-purple-200/60 text-xs font-bold px-2.5 py-0.5 rounded-full">
                {completedCount} Completed
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors mb-1">
                Completed Docs
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                View legally executed and signed agreement records.
              </p>
            </div>
          </div>
        </div>

        {/* Recent Documents Table Section */}
        <div className="space-y-4 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Recent Documents</span>
                <span className="text-xs font-normal text-slate-400">({filteredDocs.length})</span>
              </h2>
              <p className="text-xs text-slate-500">
                Access your imported, pending, and completed candidate agreements
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setFilterTab("all")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterTab === "all" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Docs
              </button>
              <button
                onClick={() => setFilterTab("completed")}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  filterTab === "completed" ? "bg-emerald-600 text-white shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Completed ({completedCount})</span>
              </button>
              <button
                onClick={() => setFilterTab("pending")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterTab === "pending" ? "bg-amber-600 text-white shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Pending
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="divide-y divide-slate-100">
              {filteredDocs.length > 0 ? (
                filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => {
                      if (onSelectDoc) {
                        onSelectDoc({
                          id: doc.id,
                          name: doc.title,
                          size: doc.size,
                          pages: doc.pages,
                          status: doc.status as any,
                          fileUrl: doc.fileUrl,
                          fileType: doc.fileType,
                          placedFields: doc.placedFields,
                          filledFields: doc.filledFields,
                        });
                      }
                      setActiveView("editor");
                    }}
                    className="flex items-center justify-between p-4 hover:bg-slate-50/80 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl flex-shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                        <FileText className="w-5 h-5 stroke-[2]" />
                      </div>
                      <div className="min-w-0 text-left">
                        <h4 className="text-xs md:text-sm font-bold text-slate-900 truncate group-hover:text-sky-600 transition-colors">
                          {doc.title}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                          <span>{doc.pages} page(s)</span>
                          <span>•</span>
                          <span>{doc.size}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {doc.updatedAt}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      {doc.status === "Completed" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Completed
                        </span>
                      )}
                      {(doc.status === "Pending" || doc.status === "Pending Sign") && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
                          <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Sign
                        </span>
                      )}
                      {doc.status === "Draft" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          <AlertCircle className="w-3.5 h-3.5 text-slate-400" /> Draft
                        </span>
                      )}

                      <div className="flex items-center gap-1 text-slate-400 group-hover:text-slate-600">
                        <button
                          className="p-1.5 hover:bg-slate-100 rounded-lg transition"
                          title="View PDF"
                        >
                          <Eye className="w-4 h-4 text-sky-600" />
                        </button>
                        <button
                          className="p-1.5 hover:bg-slate-100 rounded-lg transition"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4 text-slate-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No documents found in this section.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
