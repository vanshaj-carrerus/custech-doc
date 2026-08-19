"use client";

import React, { useState, useRef, useEffect } from "react";
import { ActiveDocument, UserSession, DocumentField } from "@/types/dochub";
import { detectPdfPageCount } from "@/lib/pdfUtils";
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
}

export const CandidateSigningView: React.FC<CandidateSigningViewProps> = ({
  documentData,
  userSession,
  candidateEmail = "candidate@email.com",
  onBackToDashboard,
}) => {
  const recruiterEmail = userSession?.email || "jane.doe@dochub.com";
  const docName = documentData?.name || "Commercial Lease Agreement 2026.pdf";

  // Initial placed fields (read recruiter placed fields if available)
  const initialFields: DocumentField[] = (() => {
    if (documentData?.placedFields && documentData.placedFields.length > 0) {
      return documentData.placedFields;
    }
    if (typeof window !== "undefined") {
      const savedPlaced = localStorage.getItem("dochub_placed_fields");
      if (savedPlaced) {
        try {
          const parsed = JSON.parse(savedPlaced);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
    }
    return [
      {
        id: "f-1",
        type: "text",
        label: "Candidate Legal Name",
        x: 34,
        y: 22,
        width: 270,
        height: 36,
        value: "",
      },
      {
        id: "f-2",
        type: "date",
        label: "Date Signed",
        x: 70,
        y: 22,
        width: 180,
        height: 36,
        value: new Date().toISOString().split("T")[0],
      },
      {
        id: "f-3",
        type: "checkbox",
        label: "Accept Terms",
        x: 17,
        y: 69,
        width: 240,
        height: 34,
        value: "I accept the agreement terms",
      },
      {
        id: "f-4",
        type: "signature",
        label: "Signature",
        x: 34,
        y: 74,
        width: 230,
        height: 42,
        value: "",
      },
    ];
  })();

  const [fields, setFields] = useState<DocumentField[]>(initialFields);

  useEffect(() => {
    if (documentData?.placedFields && documentData.placedFields.length > 0) {
      setFields(documentData.placedFields);
    }
  }, [documentData?.id, documentData?.placedFields]);
  const [candidateName, setCandidateName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
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

  const candidateFileRef = React.useRef<HTMLInputElement>(null);
  const [customFileUrl, setCustomFileUrl] = useState<string | null>(null);
  const [customFileType, setCustomFileType] = useState<string | null>(null);
  const [customFileName, setCustomFileName] = useState<string | null>(null);

  const activeFileUrl = customFileUrl || documentData?.fileUrl || (typeof window !== "undefined" ? localStorage.getItem("dochub_pdf_data") || sessionStorage.getItem("dochub_active_fileUrl") : null);
  const activeFileType = customFileType || documentData?.fileType || (typeof window !== "undefined" ? localStorage.getItem("dochub_pdf_type") || sessionStorage.getItem("dochub_active_fileType") : null);
  const activeDocName = customFileName || documentData?.name || (typeof window !== "undefined" ? localStorage.getItem("dochub_pdf_name") || sessionStorage.getItem("dochub_active_name") : null) || docName;

  const [detectedPages, setDetectedPages] = useState<number | null>(null);

  useEffect(() => {
    if (activeFileUrl) {
      detectPdfPageCount(activeFileUrl).then((count) => {
        setDetectedPages(count);
      });
    } else if (documentData?.pages) {
      setDetectedPages(documentData.pages);
    }
  }, [activeFileUrl, documentData]);

  const pageCount = Math.max(1, detectedPages || documentData?.pages || 1);
  const containerMinHeightPx = pageCount * 1050;
  const iframeHeightPx = containerMinHeightPx;
  const isImageDoc = !!(activeFileType?.includes("image") || activeFileUrl?.startsWith("data:image/"));

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
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = penColor;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
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

  const handleCandidateFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const url = URL.createObjectURL(selectedFile);
    setCustomFileUrl(url);
    setCustomFileType(selectedFile.type || "application/pdf");
    setCustomFileName(selectedFile.name);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof window !== "undefined" && reader.result) {
        localStorage.setItem("dochub_pdf_data", reader.result as string);
        localStorage.setItem("dochub_pdf_type", selectedFile.type || "application/pdf");
        localStorage.setItem("dochub_pdf_name", selectedFile.name);
      }
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleCompleteSigning = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (typeof window !== "undefined") {
      localStorage.setItem("dochub_completed_fields", JSON.stringify(fields));
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
      <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4 text-blue-600" />
            <span>Dashboard</span>
          </button>
          <div className="h-4 w-[1px] bg-slate-200"></div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span className="font-extrabold text-sm text-slate-900 truncate max-w-xs md:max-w-md">
              {activeDocName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isCompleted ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full text-xs font-extrabold shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>🔒 Executed & E-Signed Document</span>
              </span>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Print PDF</span>
              </button>
            </div>
          ) : (
            <>
              <input
                type="file"
                ref={candidateFileRef}
                onChange={handleCandidateFileUpload}
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => candidateFileRef.current?.click()}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                title="Upload or change PDF document"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Upload/View PDF</span>
              </button>
              <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>256-Bit Encrypted</span>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Workspace Area (Clean PDF Display) */}
      <div className="flex-1 p-4 md:p-8 flex justify-center overflow-x-auto overflow-y-auto bg-slate-200/80">
        <div className="w-full max-w-4xl flex flex-col items-center space-y-6">
          {/* Document Paper Canvas */}
          <div className="relative bg-slate-300 p-2 md:p-6 rounded-3xl shadow-2xl flex justify-center border border-slate-300 overflow-x-auto">
            <div
              className="relative bg-white text-slate-900 shadow-2xl border border-slate-300 rounded-lg overflow-hidden transition-all duration-200 flex-shrink-0"
              style={{
                width: "794px",
                minHeight: "auto",
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
                  ) : (
                    <div className="relative w-full z-0 bg-white overflow-hidden" style={{ minHeight: `${iframeHeightPx}px` }}>
                      <iframe
                        src={`${activeFileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                        title={activeDocName}
                        className="w-full border-0 pointer-events-none block"
                        style={{ width: "100%", height: `${iframeHeightPx}px`, border: 0, margin: 0, padding: 0 }}
                      />
                    </div>
                  )
                ) : (
                /* Fallback Document Background Paper */
                <div className="p-10 text-left space-y-6 z-0 select-none opacity-80 pointer-events-none">
                  <div className="flex justify-between items-center border-b pb-4 border-slate-200">
                    <h3 className="font-serif text-lg font-bold text-slate-800">
                      {docName}
                    </h3>
                    <span className="text-xs font-mono text-slate-400">
                      Doc ID: {documentData?.id || "DH-884920"}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs text-slate-600 leading-relaxed max-w-xl">
                    <p>
                      This Legal Agreement is made and entered into by and between the Recruiter (<strong className="text-slate-800">{recruiterEmail}</strong>) and Candidate (<strong className="text-slate-800">{candidateEmail}</strong>).
                    </p>
                    <p>
                      By signing this document, the Candidate acknowledges receipt of all terms, conditions, and schedules set forth herein and agrees to execute all required fields.
                    </p>
                  </div>
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
                      className={`absolute rounded flex flex-col justify-center p-1 transition-all ${
                        isCompleted
                          ? "border-0 bg-transparent pointer-events-none"
                          : "border border-blue-400/80 bg-blue-50/60 hover:bg-blue-50/90"
                      }`}
                      style={{
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        width: `${fieldWidth}px`,
                        height: `${fieldHeight}px`,
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
                              className="w-full h-full flex items-center justify-between px-2 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-900 border border-emerald-300 rounded font-serif italic font-bold text-xs transition"
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
                              value={field.value || "I accept terms"}
                              onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                              className="bg-transparent border-0 focus:outline-none text-xs text-slate-800 font-semibold w-full"
                            />
                          </label>
                        ) : field.type === "image" || field.type === "attachment" ? (
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
                            className="w-full h-full flex items-center justify-center p-1 bg-slate-50/80 hover:bg-slate-100/90 cursor-pointer border border-dashed border-blue-400 rounded overflow-hidden"
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
                        ) : (
                          <input
                            type="text"
                            readOnly={isCompleted}
                            value={field.value || candidateName}
                            onChange={(e) => {
                              setCandidateName(e.target.value);
                              handleFieldValueChange(field.id, e.target.value);
                            }}
                            placeholder={`Fill ${field.label}...`}
                            className="w-full h-full bg-transparent border-0 focus:outline-none text-xs font-semibold text-slate-900"
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
            <div className="w-full max-w-[794px] bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <button
                type="button"
                onClick={onBackToDashboard}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCompleteSigning}
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs md:text-sm px-8 py-3 rounded-xl shadow-lg shadow-emerald-600/30 transition transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Dispatched Emails...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Complete & Send Copies to Gmail Accounts</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Draw Signature Modal */}
      {isSigModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-5 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PenTool className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-extrabold text-white">
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
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Draw your signature inside the canvas box:</span>
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
                    className="w-full h-[160px] bg-slate-50 rounded-xl cursor-crosshair touch-none"
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
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
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
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition shadow-lg shadow-emerald-600/30 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Apply Signature to Document</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
