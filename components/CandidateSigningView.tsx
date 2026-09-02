"use client";

import React, { useState, useRef, useEffect } from "react";
import { ActiveDocument, UserSession, DocumentField } from "@/types/dochub";
import {
  getPdfjsLib,
  toUint8Array,
} from "@/lib/pdfUtils";
import { autoFillFromProfile } from "@/lib/detectFormFields";
import {
  FileText,
  CheckCircle2,
  Send,
  User,
  Mail,
  PenTool,
  Loader2,
  Sparkles,
  ArrowLeft,
  ShieldCheck,
  Check,
  Calendar,
  Lock,
  Eraser,
  X,
  RotateCcw,
  Type,
  Edit3,
  Download,
  Printer,
  Eye,
} from "lucide-react";

interface CandidateSigningViewProps {
  documentData?: ActiveDocument;
  userSession?: UserSession;
  candidateEmail?: string;
  onBackToDashboard: () => void;
  // The link emailed to a candidate is standalone — they have no portal
  // account, so any "back to dashboard"/navigation affordance would just
  // dead-end them. Set true to render the form with no way out but signing it.
  standalone?: boolean;
}

export const CandidateSigningView: React.FC<CandidateSigningViewProps> = ({
  documentData,
  userSession,
  candidateEmail = "candidate@email.com",
  onBackToDashboard,
  standalone = false,
}) => {
  const recruiterEmail = userSession?.email || "jane.doe@dochub.com";
  const docName = documentData?.name || "Commercial Lease Agreement 2026.pdf";

  useEffect(() => {
    const id = documentData?.id;
    if (!id) return;
    fetch(`/api/documents/track/${encodeURIComponent(id)}?event=view`).catch(() => {});
  }, [documentData?.id]);

  // Initial placed fields — prefer the candidate's already-submitted values
  // (filledFields) so a refresh after completing shows what was actually signed,
  // falling back to the recruiter's blank placed fields for a not-yet-signed doc.
  const initialFields: DocumentField[] = (() => {
    if (documentData?.filledFields && documentData.filledFields.length > 0) {
      return documentData.filledFields;
    }
    if (documentData?.placedFields && documentData.placedFields.length > 0) {
      return documentData.placedFields;
    }
    return [
      {
        id: "f-1",
        type: "text",
        label: "Candidate Legal Name",
        x: 8,
        y: 10,
        width: 270,
        height: 36,
        value: "",
      },
      {
        id: "f-2",
        type: "date",
        label: "Date Signed",
        x: 60,
        y: 10,
        width: 180,
        height: 36,
        value: new Date().toISOString().split("T")[0],
      },
      {
        id: "f-3",
        type: "checkbox",
        label: "Accept Terms",
        x: 8,
        y: 17,
        width: 260,
        height: 34,
        value: "I accept the agreement terms",
      },
      {
        id: "f-4",
        type: "signature",
        label: "Signature",
        x: 60,
        y: 17,
        width: 230,
        height: 42,
        value: "",
      },
    ];
  })();

  const [fields, setFields] = useState<DocumentField[]>(initialFields);

  // Checkbox and date fields always carry a usable default (a checked box,
  // today's date), so only these types actually need the candidate to have
  // entered something before the document can be submitted. Locked image/
  // attachment fields are fixed media the recruiter placed on the document —
  // the candidate can't touch them, so they're not the candidate's to fill.
  const fieldTypesRequiringValue = ["text", "paragraph", "radio", "dropdown", "signature", "image", "attachment"];
  const allFieldsFilled = fields.every(
    (f) => f.candidateLocked || !fieldTypesRequiringValue.includes(f.type) || !!f.value?.trim()
  );

  useEffect(() => {
    if (documentData?.filledFields && documentData.filledFields.length > 0) {
      setFields(documentData.filledFields);
    } else if (documentData?.placedFields && documentData.placedFields.length > 0) {
      setFields(
        autoFillFromProfile(documentData.placedFields, {
          name: documentData.recipientName,
          email: candidateEmail,
        })
      );
    }
  }, [documentData?.id, documentData?.placedFields, documentData?.filledFields, documentData?.recipientName, candidateEmail]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(documentData?.status === "Completed");

  // The doc record (with its real status) is fetched asynchronously by the parent
  // page, so pick up "Completed" once it arrives — this is what makes a refresh
  // after signing land back on the locked, read-only view instead of the blank form.
  useEffect(() => {
    if (documentData?.status === "Completed") {
      setIsCompleted(true);
    }
  }, [documentData?.status]);
  const [completionData, setCompletionData] = useState<{
    candidateEmail: string;
    recruiterEmail: string;
    document: string;
  } | null>(null);

  // Signature Modal state
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [activeSigFieldId, setActiveSigFieldId] = useState<string | null>(null);
  const [sigMode, setSigMode] = useState<"draw" | "type">("draw");
  const [typedSig, setTypedSig] = useState("");
  const [penColor, setPenColor] = useState("#1d4ed8");

  // Canvas ref for signature drawing pad
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const activeFileUrl = documentData?.fileUrl;
  const activeFileType = documentData?.fileType;
  const activeDocName = documentData?.name || docName;

  const [detectedPages, setDetectedPages] = useState<number | null>(null);
  const [detectedPageHeightPx, setDetectedPageHeightPx] = useState<number | null>(null);
  const [renderedPdfPages, setRenderedPdfPages] = useState<string[]>([]);
  const [isRenderingPdf, setIsRenderingPdf] = useState(false);

  const pageCount = Math.max(1, detectedPages || documentData?.pages || 1);
  const pageHeightPx = detectedPageHeightPx || 1050;
  const containerMinHeightPx = pageCount * pageHeightPx;
  const isImageDoc = !!(activeFileType?.includes("image") || activeFileUrl?.startsWith("data:image/"));
  const documentViewportRef = useRef<HTMLDivElement | null>(null);
  const [documentWidth, setDocumentWidth] = useState(794);

  useEffect(() => {
    if (!activeFileUrl || isImageDoc) {
      setRenderedPdfPages([]);
      setIsRenderingPdf(false);
      return;
    }

    let cancelled = false;
    setRenderedPdfPages([]);
    setIsRenderingPdf(true);

    const renderPages = async () => {
      try {
        const [pdfjsLib, bytes] = await Promise.all([
          getPdfjsLib(),
          toUint8Array(activeFileUrl),
        ]);
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        const images: string[] = [];
        const firstPage = await pdf.getPage(1);
        const firstViewport = firstPage.getViewport({ scale: 1 });
        const firstRenderScale = 794 / firstViewport.width;
        if (!cancelled) {
          setDetectedPages(pdf.numPages || 1);
          setDetectedPageHeightPx(
            Math.round(firstViewport.height * firstRenderScale)
          );
        }

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          if (cancelled) return;
          const page =
            pageNumber === 1 ? firstPage : await pdf.getPage(pageNumber);
          const initialViewport = page.getViewport({ scale: 1 });
          const renderScale = 794 / initialViewport.width;
          const viewport = page.getViewport({ scale: renderScale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d");
          if (!context) continue;

          await page.render({
            canvasContext: context,
            viewport,
            canvas,
          }).promise;
          images.push(canvas.toDataURL("image/jpeg", 0.9));
          if (!cancelled) setRenderedPdfPages([...images]);
        }
      } catch (error) {
        console.warn("Responsive PDF rendering failed:", error);
      } finally {
        if (!cancelled) setIsRenderingPdf(false);
      }
    };

    renderPages();
    return () => {
      cancelled = true;
    };
  }, [activeFileUrl, isImageDoc]);

  useEffect(() => {
    const viewport = documentViewportRef.current;
    if (!viewport) return;

    const updateWidth = () => {
      setDocumentWidth(viewport.clientWidth || 794);
    };
    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewport);
    updateWidth();
    return () => observer.disconnect();
  }, []);

  const documentScale = documentWidth / 794;
  const iframeHeightPx = containerMinHeightPx * documentScale;

  const handleFieldValueChange = (id: string, newValue: string) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, value: newValue } : f))
    );
  };

  // Open Signature Modal
  const openSignatureModal = (fieldId: string) => {
    setActiveSigFieldId(fieldId);
    setIsSigModalOpen(true);
  };

  // Drawing Canvas logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = penColor;
    ctx.lineTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const applySignature = () => {
    if (!activeSigFieldId) return;

    if (sigMode === "draw") {
      const canvas = canvasRef.current;
      if (canvas) {
        const dataUrl = canvas.toDataURL("image/png");
        handleFieldValueChange(activeSigFieldId, dataUrl);
      }
    } else {
      handleFieldValueChange(activeSigFieldId, typedSig || "Candidate Signature");
    }

    setIsSigModalOpen(false);
  };

  const handleCompleteSigning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allFieldsFilled) return;
    setIsSubmitting(true);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("dochub_completed_fields", JSON.stringify(fields));
      } catch {
        // Best-effort local cache only (e.g. large embedded images can exceed
        // the storage quota) — the real submission below is what matters.
      }
    }

    try {
      const res = await fetch("/api/documents/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId: documentData?.id,
          candidateEmail: candidateEmail,
          senderEmail: recruiterEmail,
          filledFields: fields,
        }),
      });
      const data = await res.json();
      setIsSubmitting(false);

      if (data.success && data.details) {
        setCompletionData(data.details);
      } else {
        setCompletionData({
          candidateEmail: candidateEmail,
          recruiterEmail: recruiterEmail,
          document: docName,
        });
      }
      setIsCompleted(true);
    } catch {
      setIsSubmitting(false);
      setCompletionData({
        candidateEmail: candidateEmail,
        recruiterEmail: recruiterEmail,
        document: docName,
      });
      setIsCompleted(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="min-h-16 bg-white border-b border-slate-200 px-3 py-3 md:px-8 flex items-center justify-between gap-2 sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          {!standalone && (
            <>
              <button
                onClick={onBackToDashboard}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition flex items-center gap-1.5 text-xs font-bold"
              >
                <ArrowLeft className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
              <div className="h-4 w-[1px] bg-slate-200"></div>
            </>
          )}
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span className="font-extrabold text-xs sm:text-sm text-slate-900 truncate max-w-[55vw] sm:max-w-xs md:max-w-md">
              {activeDocName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isCompleted ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-secondary/10 text-secondary border border-secondary/20 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-extrabold shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Executed & E-Signed Document</span>
                <span className="sm:hidden">Signed</span>
              </span>
              <button
                onClick={() => window.print()}
                className="p-2 sm:px-3 sm:py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Print PDF</span>
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>256-Bit Encrypted</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Area (Clean PDF Display) */}
      <div className="flex-1 p-1 sm:p-3 md:p-5 flex justify-center overflow-x-hidden overflow-y-auto bg-slate-200/80">
        <div className="w-full flex flex-col items-center space-y-4">
          {/* Document Paper Canvas */}
          <div className="relative w-full min-w-0 bg-slate-300 p-1 sm:p-2 md:p-4 rounded-lg md:rounded-2xl shadow-xl md:shadow-2xl flex justify-center border border-slate-300 overflow-hidden">
            <div
              ref={documentViewportRef}
              className="relative w-full min-w-0 bg-white text-slate-900 shadow-xl md:shadow-2xl border border-slate-300 rounded-sm md:rounded-lg overflow-hidden transition-all duration-200"
              style={{
                minHeight: activeFileUrl && isImageDoc ? "auto" : `${iframeHeightPx}px`,
              }}
            >
                {/* Embed actual uploaded document preview if fileUrl exists */}
                {activeFileUrl ? (
                  isImageDoc ? (
                    <div className="relative w-full z-0 bg-white">
                      <img
                        src={activeFileUrl}
                        alt={activeDocName}
                        className="w-full h-auto block select-none pointer-events-none"
                      />
                    </div>
                  ) : renderedPdfPages.length > 0 ? (
                    <div className="relative w-full z-0 bg-white">
                      {renderedPdfPages.map((pageImage, index) => (
                        <img
                          key={`${index}-${pageImage.length}`}
                          src={pageImage}
                          alt={`${activeDocName} – page ${index + 1}`}
                          loading={index === 0 ? "eager" : "lazy"}
                          decoding="async"
                          className="block h-auto w-full max-w-full select-none pointer-events-none"
                        />
                      ))}
                    </div>
                  ) : isRenderingPdf ? (
                    <div
                      className="flex w-full items-center justify-center gap-2 bg-white text-sm font-semibold text-slate-500"
                      style={{ minHeight: `${Math.min(500, iframeHeightPx)}px` }}
                    >
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span>Fitting agreement to your screen...</span>
                    </div>
                  ) : (
                    <div className="relative w-full z-0 bg-white overflow-hidden" style={{ minHeight: `${iframeHeightPx}px` }}>
                      <iframe
                        src={`${activeFileUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                        title={activeDocName}
                        className="w-full min-w-0 border-0 pointer-events-none block"
                        style={{ width: "100%", height: `${iframeHeightPx}px`, border: 0, margin: 0, padding: 0 }}
                      />
                    </div>
                  )
                ) : (
                <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 bg-white p-8 text-center">
                  <FileText className="h-10 w-10 text-primary" />
                  <p className="text-sm font-bold text-slate-800">
                    Uploaded document unavailable
                  </p>
                  <p className="max-w-sm text-xs text-slate-500">
                    The original file could not be found. Please ask the sender to upload and send the document again.
                  </p>
                </div>
              )}

              {/* Interactive Placed Fields Overlay (No Label Pills, No Heavy Borders) */}
              <div className="absolute inset-0 z-20 pointer-events-auto">
                {fields.map((field) => {
                  const fieldWidth = field.width || 200;
                  const fieldHeight = field.height || 36;

                  return (
                    <div
                      key={field.id}
                      className={`absolute rounded-sm flex flex-col justify-center p-1 ${
                        isCompleted
                          ? "border-0 bg-transparent pointer-events-none"
                          : "border-0 bg-[#c7d2fe] hover:bg-[#a5b4fc] focus-within:bg-[#a5b4fc]"
                      }`}
                      style={{
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        width: `${Math.max(36, fieldWidth * documentScale)}px`,
                        height: `${Math.max(24, fieldHeight * documentScale)}px`,
                      }}
                    >
                      {/* Interactive Inputs */}
                      <div className="w-full h-full flex items-center px-1 overflow-hidden">
                        {field.type === "signature" ? (
                          isCompleted || field.value ? (
                            field.value && field.value.startsWith("data:image") ? (
                              <img
                                src={field.value}
                                alt="Drawn Signature"
                                className="max-h-full max-w-full object-contain mx-auto pointer-events-none"
                              />
                            ) : (
                              <span className="text-blue-900 text-sm font-serif italic font-extrabold mx-auto">
                                {field.value || "Signed"}
                              </span>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => openSignatureModal(field.id)}
                              className="w-full h-full flex items-center justify-between px-2 text-slate-700 font-serif italic font-bold text-xs"
                            >
                              <span className="text-emerald-800 font-sans text-xs not-italic font-bold flex items-center gap-1 mx-auto">
                                <PenTool className="w-3.5 h-3.5" /> Click to Draw Signature ✍️
                              </span>
                            </button>
                          )
                        ) : field.type === "date" ? (
                          <input
                            type="date"
                            readOnly={isCompleted}
                            value={field.value || new Date().toISOString().split("T")[0]}
                            onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isCompleted && "showPicker" in e.currentTarget) {
                                try {
                                  (e.currentTarget as any).showPicker();
                                } catch {}
                              }
                            }}
                            className="w-full h-full bg-transparent border-0 focus:outline-none font-mono text-xs font-bold text-slate-800 cursor-pointer"
                          />
                        ) : field.type === "checkbox" ? (
                          <label className="flex items-center gap-2 cursor-pointer w-full text-xs font-bold text-slate-800">
                            <input
                              type="checkbox"
                              defaultChecked
                              disabled={isCompleted}
                              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <input
                              type="text"
                              readOnly={isCompleted}
                              value={field.value || field.placeholder || "I accept terms"}
                              onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                              className="bg-transparent border-0 focus:outline-none text-xs text-slate-800 font-semibold w-full"
                            />
                          </label>
                        ) : field.type === "radio" ? (
                          <div className="w-full h-full flex flex-col justify-center gap-1 overflow-y-auto py-1">
                            {(field.options && field.options.length > 0 ? field.options : ["Option 1"]).map(
                              (option, idx) => (
                                <label
                                  key={idx}
                                  className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800"
                                  style={{ fontSize: `${field.fontSize || 14}px` }}
                                >
                                  <input
                                    type="radio"
                                    name={field.id}
                                    disabled={isCompleted}
                                    checked={field.value === option}
                                    onChange={() => handleFieldValueChange(field.id, option)}
                                    className="text-blue-600 focus:ring-blue-500 flex-shrink-0"
                                    style={{
                                      width: `${Math.max(12, field.fontSize || 14)}px`,
                                      height: `${Math.max(12, field.fontSize || 14)}px`,
                                    }}
                                  />
                                  <span>{option}</span>
                                </label>
                              )
                            )}
                          </div>
                        ) : field.type === "dropdown" ? (
                          <select
                            disabled={isCompleted}
                            value={field.value || ""}
                            onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                            className="w-full h-full bg-transparent border-0 focus:outline-none text-slate-900 font-semibold cursor-pointer"
                            style={{ fontSize: `${field.fontSize || 14}px` }}
                          >
                            <option value="" disabled>
                              Select an option
                            </option>
                            {(field.options && field.options.length > 0 ? field.options : ["Option 1"]).map(
                              (option, idx) => (
                                <option key={idx} value={option}>
                                  {option}
                                </option>
                              )
                            )}
                          </select>
                        ) : field.type === "image" || field.type === "attachment" ? (
                          field.candidateLocked ? (
                            // Media the recruiter placed on the document (e.g. via the editor's
                            // Upload button) — fixed content, not something the candidate can
                            // replace.
                            <div className="w-full h-full flex items-center justify-center p-1 overflow-hidden">
                              {field.value && field.value.startsWith("data:image") ? (
                                <img
                                  src={field.value}
                                  alt="Document media"
                                  className="max-h-full max-w-full object-contain mx-auto pointer-events-none"
                                />
                              ) : (
                                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold truncate">
                                  <FileText className="w-4 h-4 text-slate-500" />
                                  <span className="truncate">Attached File</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                if (!isCompleted) {
                                  const fileInput = document.createElement("input");
                                  fileInput.type = "file";
                                  fileInput.accept = "image/*,.pdf";
                                  fileInput.onchange = (e: any) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onload = () => {
                                        handleFieldValueChange(field.id, reader.result as string);
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  };
                                  fileInput.click();
                                }
                              }}
                              className="w-full h-full flex items-center justify-center p-1 cursor-pointer overflow-hidden"
                            >
                              {field.value ? (
                                field.value.startsWith("data:image") ? (
                                  <img
                                    src={field.value}
                                    alt="Uploaded Attachment"
                                    className="max-h-full max-w-full object-contain mx-auto pointer-events-none"
                                  />
                                ) : (
                                  <div className="flex items-center gap-1.5 text-xs text-blue-700 font-bold truncate">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                    <span className="truncate">Attached File</span>
                                  </div>
                                )
                              ) : (
                                <span className="text-[11px] text-blue-700 font-bold flex items-center gap-1">
                                  <FileText className="w-3.5 h-3.5" /> Upload Image / PDF
                                </span>
                              )}
                            </div>
                          )
                        ) : (
                          <input
                            type="text"
                            readOnly={isCompleted}
                            value={field.value || ""}
                            onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                            placeholder={
                              field.placeholder && field.placeholder !== "Text Field"
                                ? field.placeholder
                                : field.label && field.label !== "Text Field"
                                  ? field.label
                                  : "Type here"
                            }
                            className="w-full h-full bg-transparent border-0 focus:outline-none text-xs font-semibold text-slate-900 placeholder:text-indigo-800 placeholder:font-semibold"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Actions Bar below canvas */}
          {!isCompleted && (
            <div className={`sticky bottom-2 z-30 w-full bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl p-3 sm:p-4 flex items-center shadow-lg ${standalone ? "justify-end" : "justify-between"}`}>
              {!standalone && (
                <button
                  type="button"
                  onClick={onBackToDashboard}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
              )}

              <button
                type="button"
                onClick={handleCompleteSigning}
                disabled={isSubmitting || !allFieldsFilled}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/90 active:bg-secondary text-white font-extrabold text-xs md:text-sm px-4 sm:px-8 py-3 rounded-xl shadow-lg shadow-secondary/30 transition transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Dispatched Emails...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span className="sm:hidden">Complete & Send</span>
                    <span className="hidden sm:inline">Complete & Send Copies to Gmail Accounts</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Draw Signature Modal */}
      {isSigModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl sm:rounded-3xl w-full max-w-lg max-h-[96dvh] overflow-y-auto shadow-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PenTool className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base sm:text-lg font-extrabold text-white">
                  Add Candidate Digital Signature
                </h3>
              </div>
              <button
                onClick={() => setIsSigModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Signature Mode Tabs */}
            <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSigMode("draw")}
                className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                  sigMode === "draw"
                    ? "bg-emerald-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Draw Signature ✍️</span>
              </button>
              <button
                type="button"
                onClick={() => setSigMode("type")}
                className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                  sigMode === "type"
                    ? "bg-emerald-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>Type Signature 🔤</span>
              </button>
            </div>

            {/* Mode Content */}
            {sigMode === "draw" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                  <span className="hidden sm:inline">Draw your signature inside the canvas box:</span>
                  <span className="sm:hidden">Draw your signature:</span>
                  <div className="flex items-center gap-2">
                    {/* Pen colors */}
                    <button
                      type="button"
                      onClick={() => setPenColor("#1d4ed8")}
                      className={`w-5 h-5 rounded-full bg-blue-600 border-2 ${
                        penColor === "#1d4ed8" ? "border-white scale-110" : "border-transparent"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setPenColor("#0f172a")}
                      className={`w-5 h-5 rounded-full bg-slate-900 border-2 ${
                        penColor === "#0f172a" ? "border-white scale-110" : "border-transparent"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setPenColor("#047857")}
                      className={`w-5 h-5 rounded-full bg-emerald-600 border-2 ${
                        penColor === "#047857" ? "border-white scale-110" : "border-transparent"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-1 text-[10px] font-bold transition ml-2"
                    >
                      <RotateCcw className="w-3 h-3" /> Clear
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border-2 border-dashed border-emerald-500/50 p-2 overflow-hidden flex justify-center">
                  <canvas
                    ref={canvasRef}
                    width={440}
                    height={160}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-[130px] sm:h-[160px] bg-slate-50 rounded-xl cursor-crosshair touch-none"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-300">
                  Type Your Signature Name:
                </label>
                <input
                  type="text"
                  value={typedSig}
                  onChange={(e) => setTypedSig(e.target.value)}
                  placeholder="e.g. Vanshaj Sharma"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />

                {/* Preview Box */}
                <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 text-center">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block mb-2 font-bold">
                    Live Signature Preview:
                  </span>
                  <div className="text-3xl font-serif italic text-emerald-400 font-extrabold tracking-wide">
                    {typedSig || "Your Signature"}
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsSigModalOpen(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applySignature}
                className="flex-1 sm:flex-none justify-center px-4 sm:px-6 py-2.5 bg-secondary hover:bg-secondary/90 text-white rounded-xl text-xs font-extrabold transition shadow-lg shadow-secondary/30 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span className="sm:hidden">Apply Signature</span>
                <span className="hidden sm:inline">Apply Signature to Document</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
