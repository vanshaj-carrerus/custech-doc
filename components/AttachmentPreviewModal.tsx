"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, Loader2, X } from "lucide-react";

interface AttachmentPreviewModalProps {
  // The attachment field's stored value — a data URL from FileReader, or a hosted URL.
  value: string;
  title?: string;
  onClose: () => void;
}

function mimeOf(value: string) {
  const match = /^data:([^;,]+)/.exec(value);
  if (match) return match[1].toLowerCase();
  if (/\.pdf($|\?)/i.test(value)) return "application/pdf";
  if (/\.(png|jpe?g|gif|webp|svg)($|\?)/i.test(value)) return "image/*";
  return "";
}

function extensionFor(mime: string) {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return mime.split("/")[1]?.replace("jpeg", "jpg").replace("*", "png") || "png";
  return "bin";
}

// Chrome refuses to render data: PDFs inside iframes, so data URLs are converted
// to blob: URLs before being shown.
export default function AttachmentPreviewModal({ value, title = "Attached File", onClose }: AttachmentPreviewModalProps) {
  const mime = mimeOf(value);
  const isPdf = mime === "application/pdf";
  const isImage = mime.startsWith("image/");
  const [src, setSrc] = useState<string | null>(value.startsWith("data:") ? null : value);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!value.startsWith("data:")) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    fetch(value)
      .then((res) => res.blob())
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [value]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fileName = `${title.replace(/[^\w.-]+/g, "_")}.${extensionFor(mime)}`;

  if (typeof document === "undefined") return null;

  // Portaled to <body> so a transformed/scaled ancestor in the editor can't become
  // the containing block for `position: fixed` and push the panel off-screen.
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/70 flex items-center justify-center p-2 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="font-semibold text-slate-800 truncate">{title}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {src && (
              <a
                href={src}
                download={fileName}
                className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center">
          {error ? (
            <p className="text-sm text-slate-600">This file could not be loaded.</p>
          ) : !src ? (
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          ) : isImage ? (
            <img src={src} alt={title} className="max-w-full max-h-full object-contain" />
          ) : isPdf ? (
            <iframe src={src} title={title} className="w-full h-full border-0 bg-white" />
          ) : (
            <p className="text-sm text-slate-600 px-4 text-center">
              Preview isn&apos;t available for this file type. Use Download to open it.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
