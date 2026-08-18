"use client";

import React, { useState, useEffect } from "react";
import { ActiveView, RecentDoc, ActiveDocument } from "@/types/dochub";
import {
  Home,
  UploadCloud,
  LayoutTemplate,
  PenTool,
  ChevronRight,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Download,
  Eye,
  Plus,
  Filter,
} from "lucide-react";

interface DashboardViewProps {
  setActiveView: (view: ActiveView) => void;
  onSelectDoc?: (doc: ActiveDocument) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveView, onSelectDoc }) => {
  const [mongoDocs, setMongoDocs] = useState<RecentDoc[]>([]);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [filterTab, setFilterTab] = useState<"all" | "completed" | "pending">("all");

  useEffect(() => {
    fetch("/api/documents/list")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.documents) {
          setIsDbConnected(true);
          if (data.documents.length > 0) {
            setMongoDocs(data.documents);
          }
        }
      })
      .catch((err) => console.warn("MongoDB fetch warning:", err));

    // Check localStorage for local completed documents
    if (typeof window !== "undefined") {
      const savedCompleted = localStorage.getItem("dochub_completed_fields");
      if (savedCompleted) {
        try {
          const docName = localStorage.getItem("dochub_pdf_name") || "Commercial Lease Agreement 2026.pdf";
          setMongoDocs((prev) => {
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
            return prev.map((d) => (d.title === docName ? { ...d, status: "Completed" } : d));
          });
        } catch {}
      }
    }
  }, []);

  const defaultDocs: RecentDoc[] = mongoDocs.length > 0 ? mongoDocs : [
    {
      id: "doc-1",
      title: "Commercial Lease Agreement 2026.pdf",
      updatedAt: "10 mins ago",
      pages: 14,
      status: "Completed",
      size: "2.4 MB",
    },
    {
      id: "doc-2",
      title: "Consulting_Services_SOW_v3.pdf",
      updatedAt: "2 hours ago",
      pages: 6,
      status: "Pending",
      size: "1.1 MB",
    },
    {
      id: "doc-3",
      title: "Employee NDA & Onboarding.pdf",
      updatedAt: "Yesterday",
      pages: 4,
      status: "Draft",
      size: "890 KB",
    },
  ];

  const filteredDocs = defaultDocs.filter((doc) => {
    if (filterTab === "completed") return doc.status === "Completed";
    if (filterTab === "pending") return doc.status === "Pending" || doc.status === "Pending Sign";
    return true;
  });

  const completedCount = defaultDocs.filter((d) => d.status === "Completed").length;

  return (
    <div className="flex-1 bg-slate-50 min-h-[calc(100vh-64px)] p-4 md:p-8 lg:p-12 overflow-y-auto">
      <div className="max-w-3xl mx-auto flex flex-col items-center text-center pt-4 pb-10">
        {/* Large Blue Home Icon Header */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 mb-6 shadow-sm border border-blue-200/60 ring-4 ring-blue-50">
          <Home className="w-8 h-8 stroke-[2]" />
        </div>

        {/* Hero Title & Subtitle */}
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
          DocHub Workspace
        </h1>
        <p className="text-slate-500 text-sm md:text-base max-w-lg mb-8 leading-relaxed">
          Import, edit, sign, and manage legal agreements, NDAs, and commercial PDF documents in one central hub.
        </p>

        {/* Quick Action Cards Grid */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          {/* Card 1: Import Document */}
          <div
            onClick={() => setActiveView("import")}
            className="group relative flex flex-col justify-between p-5 bg-white hover:bg-blue-50/40 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <UploadCloud className="w-5 h-5" />
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors mb-1">
                Import Document
              </h3>
              <p className="text-xs text-slate-500">
                Upload PDF, DOCX, or images to edit or add form fields.
              </p>
            </div>
          </div>

          {/* Card 2: Send Sign Request */}
          <div
            onClick={() => setActiveView("editor")}
            className="group relative flex flex-col justify-between p-5 bg-white hover:bg-emerald-50/40 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <PenTool className="w-5 h-5" />
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors mb-1">
                Send Sign Request
              </h3>
              <p className="text-xs text-slate-500">
                Request candidate e-signatures and track status.
              </p>
            </div>
          </div>

          {/* Card 3: Completed Documents */}
          <div
            onClick={() => setFilterTab("completed")}
            className="group relative flex flex-col justify-between p-5 bg-white hover:bg-purple-50/40 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="bg-purple-100 text-purple-700 text-xs font-extrabold px-2 py-0.5 rounded-full">
                {completedCount} Completed
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors mb-1">
                Completed Docs
              </h3>
              <p className="text-xs text-slate-500">
                View candidate signed and legally executed agreements.
              </p>
            </div>
          </div>
        </div>

        {/* Recent Activity / Documents Section */}
        <div className="w-full mt-10 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <span>Recent Documents</span>
                <span className="text-xs font-normal text-slate-400">({filteredDocs.length})</span>
              </h2>
              <p className="text-xs text-slate-500">
                Access your imported, pending, and completed candidate agreements
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setFilterTab("all")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterTab === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Docs
              </button>
              <button
                onClick={() => setFilterTab("completed")}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                  filterTab === "completed" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Completed ({completedCount})</span>
              </button>
              <button
                onClick={() => setFilterTab("pending")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterTab === "pending" ? "bg-amber-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Pending
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
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
                        });
                      }
                      setActiveView("editor");
                    }}
                    className="flex items-center justify-between p-4 hover:bg-slate-50/80 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="p-2.5 bg-red-50 text-red-600 rounded-xl flex-shrink-0 group-hover:scale-105 transition-transform">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 text-left">
                        <h4 className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                          {doc.title}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                          <span>{doc.pages} pages</span>
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
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Completed Document
                        </span>
                      )}
                      {(doc.status === "Pending" || doc.status === "Pending Sign") && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" /> Pending Sign
                        </span>
                      )}
                      {doc.status === "Draft" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          <AlertCircle className="w-3 h-3" /> Draft
                        </span>
                      )}

                      <div className="flex items-center gap-1 text-slate-400 group-hover:text-slate-600">
                        <button
                          className="p-1.5 hover:bg-slate-100 rounded-lg transition"
                          title="View PDF"
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
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
