"use client";

import React, { useEffect, useRef, useState } from "react";
import { ActiveDocument, ActiveView, RecentDoc, UserSession } from "@/types/dochub";
import { uploadDocumentFile } from "@/lib/uploadDocumentFile";
import {
  LayoutTemplate,
  Upload,
  Loader2,
  FileText,
  Trash2,
  ArrowRight,
} from "lucide-react";

interface TemplatesViewProps {
  setActiveView: (view: ActiveView) => void;
  onUseTemplate: (doc: ActiveDocument) => void;
  userSession?: UserSession;
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({
  setActiveView,
  onUseTemplate,
  userSession,
}) => {
  const userEmail = userSession?.email?.toLowerCase();

  const [templates, setTemplates] = useState<RecentDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTemplates = () => {
    if (!userEmail) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetch(`/api/documents?email=${encodeURIComponent(userEmail)}&template=true`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.documents) setTemplates(data.documents);
      })
      .catch((err) => console.warn("Template list fetch error:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(loadTemplates, [userEmail]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file || !userEmail) return;

    setUploadError("");
    setIsUploading(true);
    setUploadStatus("Reading file...");

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Could not read the selected file"));
        reader.readAsDataURL(file);
      });

      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const size = sizeMb === "0.0" ? `${(file.size / 1024).toFixed(0)} KB` : `${sizeMb} MB`;

      setUploadStatus("Saving template...");
      const draftRes = await fetch("/api/documents/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size,
          pages: 1,
          senderEmail: userEmail,
          fileType: file.type || "application/pdf",
          isTemplate: true,
        }),
      });
      const draftData = await draftRes.json();
      const savedId = draftData.document?.id;
      if (!draftRes.ok || !draftData.success || !savedId) {
        throw new Error(draftData.message || "Could not save this template");
      }

      setUploadStatus("Uploading...");
      await uploadDocumentFile(savedId, dataUrl, file.type, (done, total) => {
        setUploadStatus(total ? `Uploading ${Math.round((done / total) * 100)}%` : "Uploading...");
      });

      loadTemplates();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not upload this template");
    } finally {
      setIsUploading(false);
      setUploadStatus("");
    }
  };

  const handleUseTemplate = async (templateId: string) => {
    if (!userEmail || openingId) return;
    setOpeningId(templateId);
    try {
      const res = await fetch("/api/templates/use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, senderEmail: userEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.document) {
        throw new Error(data.message || "Could not open this template");
      }
      onUseTemplate(data.document);
      setActiveView("editor");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not open this template");
    } finally {
      setOpeningId(null);
    }
  };

  const handleDelete = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userEmail || deletingId) return;
    setDeletingId(templateId);
    try {
      await fetch(
        `/api/documents?id=${encodeURIComponent(templateId)}&requesterEmail=${encodeURIComponent(userEmail)}`,
        { method: "DELETE" }
      );
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch (err) {
      console.warn("Template delete error:", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 min-h-[calc(100vh-64px)] p-4 md:p-8 lg:p-12 overflow-y-auto font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-indigo-100 text-indigo-700 rounded-2xl border border-indigo-200 flex-shrink-0 shadow-2xs">
              <LayoutTemplate className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-extrabold text-slate-900">Templates</h1>
                <span className="bg-indigo-100 text-indigo-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-300">
                  {templates.length} Total
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 max-w-lg">
                Upload a reusable document once. Every time you open a template it starts a
                brand-new copy with its own ID, ready to fill in and send.
              </p>
            </div>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-6 md:p-8">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            className="hidden"
          />
          <div
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all min-h-[180px] ${
              isUploading
                ? "border-indigo-300 bg-indigo-50/40 cursor-wait"
                : "border-slate-300 hover:border-indigo-500 bg-white hover:bg-indigo-50/30 cursor-pointer"
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
                <p className="text-sm font-bold text-slate-700">{uploadStatus || "Uploading..."}</p>
              </>
            ) : (
              <>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full mb-3">
                  <Upload className="w-6 h-6 stroke-[2]" />
                </div>
                <p className="text-sm font-bold text-slate-800">Upload a new template</p>
                <p className="text-xs text-slate-400 mt-1">Click to browse or drop a file here</p>
              </>
            )}
          </div>
          {uploadError && (
            <p className="mt-3 text-xs font-semibold text-red-600 text-center">{uploadError}</p>
          )}
        </div>

        {/* Template List */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
            Saved Templates
          </div>

          <div className="divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </div>
            ) : templates.length > 0 ? (
              templates.map((tpl) => {
                const isOpening = openingId === tpl.id;
                const isDeleting = deletingId === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleUseTemplate(tpl.id)}
                    className={`flex items-center justify-between p-5 hover:bg-slate-50/90 transition cursor-pointer group ${
                      isOpening || isDeleting ? "opacity-60 pointer-events-none" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-200 flex-shrink-0 group-hover:scale-105 transition-transform">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 text-left">
                        <h3 className="text-sm md:text-base font-extrabold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                          {tpl.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs text-slate-400 mt-1 font-medium">
                          <span>{tpl.size}</span>
                          <span>•</span>
                          <span>Added {tpl.updatedAt}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      <button
                        onClick={(e) => handleDelete(tpl.id, e)}
                        disabled={isDeleting}
                        className="p-2 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-xl transition"
                        title="Delete template"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                      <span className="px-3 py-1.5 bg-indigo-600 group-hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5">
                        {isOpening ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            Use Template
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <LayoutTemplate className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-600">
                  No templates yet. Upload one above to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
