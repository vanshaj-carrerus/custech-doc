"use client";

import React, { useState } from "react";
import { ActiveView, UploadedFile, ActiveDocument } from "@/types/dochub";
import {
  Upload,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  Plus,
  CheckCircle,
  HardDrive,
  Cloud,
  Lock,
  Zap,
  SlidersHorizontal,
} from "lucide-react";

interface FileImportViewProps {
  setActiveView: (view: ActiveView) => void;
  onImportComplete?: (doc?: ActiveDocument) => void;
}

export const FileImportView: React.FC<FileImportViewProps> = ({
  setActiveView,
  onImportComplete,
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Options toggles
  const [enableOcr, setEnableOcr] = useState(false);
  const [compressPdf, setCompressPdf] = useState(true);

  // Uploaded files list starts empty (no dummy data)
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const handleRemoveFile = (id: string) => {
    setFiles(files.filter((f) => f.id !== id));
  };

  const handleStartImport = async () => {
    setIsImporting(true);
    const targetFile = files[files.length - 1] || files[0];
    let dataUrl: string | undefined;

    if (targetFile?.fileObject) {
      setImportStatus("Reading file...");
      dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(targetFile.fileObject!);
      });
    }

    const detectedFields: ActiveDocument["placedFields"] = [];

    const activeDoc: ActiveDocument = targetFile
      ? {
          id: targetFile.id,
          name: targetFile.name,
          size: targetFile.size,
          pages: targetFile.pages,
          fileUrl: dataUrl,
          fileType: targetFile.fileObject?.type || (targetFile.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image"),
          status: "Draft",
          placedFields: detectedFields,
        }
      : {
          id: "doc-imported",
          name: "Uploaded_Document_2026.pdf",
          size: "2.4 MB",
          pages: 1,
          status: "Draft",
          placedFields: detectedFields,
        };

    if (typeof window !== "undefined") {
      // The PDF itself stays in activeDocument state. Base64 PDFs can easily
      // exceed the 5–10 MB Web Storage quota and previously stopped imports.
      localStorage.removeItem("dochub_pdf_data");
      sessionStorage.removeItem("dochub_active_fileUrl");

      try {
        localStorage.removeItem("dochub_completed_fields");
        localStorage.removeItem("dochub_text_edits");
        localStorage.setItem("dochub_placed_fields", JSON.stringify(detectedFields || []));
        localStorage.setItem("dochub_pdf_type", activeDoc.fileType || "application/pdf");
        localStorage.setItem("dochub_pdf_name", activeDoc.name);
        sessionStorage.setItem(
          "dochub_active_fileType",
          activeDoc.fileType || "application/pdf"
        );
        sessionStorage.setItem("dochub_active_name", activeDoc.name);
      } catch (error) {
        console.warn("Document metadata cache was skipped:", error);
      }
    }

    setImportStatus("");
    setIsImporting(false);

    if (onImportComplete) {
      onImportComplete(activeDoc);
    } else {
      setActiveView("editor");
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleTriggerFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const fileList = Array.from(selectedFiles);
    const newUploadedFiles: UploadedFile[] = fileList.map((file, index) => {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        return {
          id: `file-${Date.now()}-${index}`,
          name: file.name,
          size: sizeMb === "0.0" ? `${(file.size / 1024).toFixed(0)} KB` : `${sizeMb} MB`,
          // The editor's single PDF.js pass determines the real page count.
          pages: 1,
          progress: 100,
          status: "ready",
          fileObject: file,
        };
      });

    setFiles((prev) => [...prev, ...newUploadedFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddSimulatedFile = () => {
    handleTriggerFilePicker();
  };

  return (
    <div className="flex-1 bg-slate-100 min-h-[calc(100vh-64px)] p-4 md:p-8 flex items-center justify-center overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-4">
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Add Files
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Upload one or more files to get started with CUS-DOC
              </p>
            </div>
            <button
              onClick={() => setActiveView("dashboard")}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Upload Zone (Grid of files + dropzone) */}
        <div className="p-6 md:p-8 bg-slate-50/50">
          <div className={`grid gap-4 ${files.length > 0 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
            {/* File Cards */}
            {files.map((file) => (
              <div
                key={file.id}
                className="relative bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition flex gap-4 items-center group overflow-hidden"
              >
                {/* Thumbnail Preview container */}
                <div className="relative w-20 h-24 bg-slate-100 border border-slate-200 rounded-lg flex flex-col justify-between p-2 flex-shrink-0 overflow-hidden shadow-2xs">
                  {/* Miniature Document structure */}
                  <div className="w-full h-3 bg-red-500/20 rounded-xs mb-1"></div>
                  <div className="space-y-1">
                    <div className="w-full h-1.5 bg-slate-300 rounded-xs"></div>
                    <div className="w-4/5 h-1.5 bg-slate-300 rounded-xs"></div>
                    <div className="w-3/5 h-1.5 bg-slate-300 rounded-xs"></div>
                  </div>
                  <div className="w-full flex justify-between items-center text-[8px] font-bold text-red-600 pt-1 border-t border-slate-200">
                    <span>PDF</span>
                    <span>v1.0</span>
                  </div>

                  {/* Processing Overlay if uploading/processing */}
                  {file.status === "processing" && (
                    <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-[1px] flex flex-col items-center justify-center text-white p-1 text-center animate-in fade-in">
                      <Loader2 className="w-5 h-5 text-blue-400 animate-spin mb-1" />
                      <span className="text-[10px] font-bold">Processing</span>
                      <span className="text-[9px] text-slate-300">
                        {file.progress}%
                      </span>
                    </div>
                  )}
                </div>

                {/* File Details */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-start justify-between">
                    <h4 className="text-sm font-bold text-slate-900 truncate pr-2">
                      {file.name}
                    </h4>
                    <button
                      onClick={() => handleRemoveFile(file.id)}
                      className="text-slate-400 hover:text-red-500 p-1 rounded-md transition"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-700 font-bold text-[10px] uppercase border border-red-100">
                      PDF
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {file.pages} pages
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500">{file.size}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          file.status === "ready"
                            ? "bg-emerald-500"
                            : "bg-blue-600"
                        }`}
                        style={{ width: `${file.progress}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
                      <span>
                        {file.status === "ready" ? (
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Ready for Import
                          </span>
                        ) : (
                          "Extracting pages & text..."
                        )}
                      </span>
                      <span>{file.progress}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Hidden Native File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              className="hidden"
            />

            {/* Dropzone Container */}
            <div
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("button")) return;
                handleTriggerFilePicker();
              }}
              className={`relative border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/30 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer group ${
                files.length === 0 ? "min-h-[260px]" : "min-h-[160px]"
              }`}
            >
              <div
                onClick={handleTriggerFilePicker}
                className="p-3 bg-blue-50 text-blue-600 rounded-full mb-3 group-hover:scale-110 transition-transform cursor-pointer"
              >
                <Upload className="w-6 h-6 stroke-[2]" />
              </div>

              {/* Add More Files dropdown button */}
              <div className="relative z-10">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTriggerFilePicker();
                    }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-l-lg shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add More Files</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDropdown(!showDropdown);
                    }}
                    className="bg-blue-700 hover:bg-blue-800 text-white p-2 rounded-r-lg border-l border-blue-500 transition"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Cloud dropdown options */}
                {showDropdown && (
                  <div className="absolute top-full mt-2 left-0 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden py-1 text-left animate-in fade-in">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTriggerFilePicker();
                        setShowDropdown(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <HardDrive className="w-4 h-4 text-slate-500" />
                      From Computer
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Add simulated cloud document from Google Drive
                        setFiles((prev) => [
                          ...prev,
                          {
                            id: `file-gdrive-${Date.now()}`,
                            name: `Google_Drive_Import_${prev.length + 1}.pdf`,
                            size: "4.2 MB",
                            pages: 12,
                            progress: 100,
                            status: "ready",
                          },
                        ]);
                        setShowDropdown(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Cloud className="w-4 h-4 text-blue-500" />
                      Google Drive
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Add simulated cloud document from Dropbox
                        setFiles((prev) => [
                          ...prev,
                          {
                            id: `file-dropbox-${Date.now()}`,
                            name: `Dropbox_Shared_Doc_${prev.length + 1}.pdf`,
                            size: "1.8 MB",
                            pages: 6,
                            progress: 100,
                            status: "ready",
                          },
                        ]);
                        setShowDropdown(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Zap className="w-4 h-4 text-indigo-500" />
                      Dropbox
                    </button>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-400 mt-2">or drop files here</p>
            </div>
          </div>
        </div>

        {/* Options Accordion & Footer */}
        <div className="p-6 md:p-8 bg-white border-t border-slate-100">
          {/* Options Accordion */}
          <div className="border border-slate-200 rounded-xl mb-6 overflow-hidden bg-slate-50/50">
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="w-full flex items-center justify-between p-4 text-left font-bold text-xs md:text-sm text-slate-700 hover:bg-slate-100 transition"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                <span>Import Options & Settings</span>
              </div>
              {showOptions ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showOptions && (
              <div className="p-4 pt-2 border-t border-slate-200/80 bg-white grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={enableOcr}
                    onChange={(e) => setEnableOcr(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      OCR Text Recognition <Lock className="w-3 h-3 text-amber-500" />
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Make scanned PDFs editable
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={compressPdf}
                    onChange={(e) => setCompressPdf(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">
                      Optimize PDF Size
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Reduce size without losing resolution
                    </span>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActiveView("dashboard")}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-4 py-2.5 rounded-lg hover:bg-slate-100 transition"
            >
              Cancel
            </button>

            {/* Primary Blue 'Import' Button with Loading Spinner inside */}
            <button
              onClick={handleStartImport}
              disabled={isImporting || files.length === 0}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 active:bg-primary text-white text-xs md:text-sm font-bold px-6 py-2.5 rounded-xl shadow-md shadow-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{importStatus || "Importing Files..."}</span>
                </>
              ) : (
                <>
                  <span>Import ({files.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
