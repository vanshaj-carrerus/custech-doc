"use client";

import React, { useState, useRef, useEffect } from "react";
import { ActiveView, DocumentField, ActiveDocument } from "@/types/dochub";
import { detectPdfPageCount } from "@/lib/pdfUtils";
import {
  ArrowLeft,
  Grid,
  Printer,
  Undo2,
  Redo2,
  MousePointer,
  Bold,
  Italic,
  Palette,
  List,
  ListOrdered,
  PenTool,
  Zap,
  HelpCircle,
  Download,
  Share2,
  MoreVertical,
  Type,
  AlignLeft,
  CheckSquare,
  Upload,
  CircleDot,
  ChevronDownSquare,
  Image as ImageIcon,
  Paperclip,
  Calendar,
  Lock,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  X,
  Stamp,
  GripVertical,
  Check,
  FileText,
  Move,
  Send,
} from "lucide-react";

interface PDFEditorViewProps {
  setActiveView: (view: ActiveView) => void;
  onOpenWalkthrough: () => void;
  onOpenSendModal?: () => void;
  documentData?: ActiveDocument;
}

export const PDFEditorView: React.FC<PDFEditorViewProps> = ({
  setActiveView,
  onOpenWalkthrough,
  onOpenSendModal,
  documentData,
}) => {
  const isCompletedDoc = documentData?.status === "Completed" || (typeof window !== "undefined" && (!documentData || !documentData.status) && !!localStorage.getItem("dochub_completed_fields"));

  // Paper canvas ref for position calculations
  const paperRef = useRef<HTMLDivElement>(null);

  // Formatting state
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#1e293b");
  const [fontSize, setFontSize] = useState("14px");
  const [showSignDropdown, setShowSignDropdown] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [detectedPages, setDetectedPages] = useState<number | null>(null);

  useEffect(() => {
    const activeFileUrl =
      documentData?.fileUrl ||
      (typeof window !== "undefined"
        ? localStorage.getItem("dochub_pdf_data") || sessionStorage.getItem("dochub_active_fileUrl")
        : null);

    if (activeFileUrl) {
      detectPdfPageCount(activeFileUrl).then((count) => {
        setDetectedPages(count);
      });
    } else if (documentData?.pages) {
      setDetectedPages(documentData.pages);
    }
  }, [documentData?.id, documentData?.fileUrl]);

  const pageCount = Math.max(1, detectedPages || documentData?.pages || 1);
  const canvasMinHeightPx = pageCount * 1050;
  const iframeHeightPx = canvasMinHeightPx;

  const activeFileUrl = documentData?.fileUrl || (typeof window !== "undefined" ? localStorage.getItem("dochub_pdf_data") || sessionStorage.getItem("dochub_active_fileUrl") : null);
  const activeFileType = documentData?.fileType || (typeof window !== "undefined" ? localStorage.getItem("dochub_pdf_type") || sessionStorage.getItem("dochub_active_fileType") : null);
  const docTitle = documentData?.name || (typeof window !== "undefined" ? localStorage.getItem("dochub_pdf_name") : null) || "Document.pdf";
  const isImageDoc = !!(activeFileType?.includes("image") || activeFileUrl?.startsWith("data:image/"));

  // Placed interactive document fields on the A4 page
  const [placedFields, setPlacedFields] = useState<DocumentField[]>(() => {
    if (typeof window !== "undefined") {
      const savedCompleted = localStorage.getItem("dochub_completed_fields");
      if (savedCompleted) {
        try {
          return JSON.parse(savedCompleted);
        } catch {}
      }
      const savedPlaced = localStorage.getItem("dochub_placed_fields");
      if (savedPlaced) {
        try {
          return JSON.parse(savedPlaced);
        } catch {}
      }
    }
    return [
      {
        id: "f-1",
        type: "text",
        label: "Text Field",
        x: 25,
        y: 20,
        width: 260,
        height: 34,
        value: "Jane Doe (Client Representative)",
        fontSize: 14,
      },
      {
        id: "f-2",
        type: "date",
        label: "Date Signed",
        x: 65,
        y: 20,
        width: 170,
        height: 34,
        value: "August 18, 2026",
        fontSize: 13,
      },
      {
        id: "f-3",
        type: "signature",
        label: "Signature",
        x: 25,
        y: 75,
        width: 220,
        height: 42,
        isLocked: true,
      },
      {
        id: "f-4",
        type: "checkbox",
        label: "Check",
        x: 10,
        y: 70,
        width: 230,
        height: 34,
        value: "I accept the agreement terms",
      },
    ];
  });

  useEffect(() => {
    if (documentData) {
      const targetFields =
        documentData.filledFields && documentData.filledFields.length > 0
          ? documentData.filledFields
          : documentData.placedFields && documentData.placedFields.length > 0
          ? documentData.placedFields
          : null;

      if (targetFields) {
        const currentStr = JSON.stringify(placedFields);
        const targetStr = JSON.stringify(targetFields);
        if (currentStr !== targetStr) {
          setPlacedFields(targetFields);
        }
      }
    }
  }, [documentData?.id, documentData?.filledFields, documentData?.placedFields]);

  useEffect(() => {
    if (typeof window !== "undefined" && placedFields.length > 0) {
      localStorage.setItem("dochub_placed_fields", JSON.stringify(placedFields));
    }
  }, [placedFields]);

  const [activeFieldId, setActiveFieldId] = useState<string | null>("f-1");

  // Document Building Blocks definition
  const buildingBlocks = [
    { type: "text", label: "Text Field", icon: Type, isLocked: false },
    { type: "paragraph", label: "Paragraph", icon: AlignLeft, isLocked: false },
    { type: "checkbox", label: "Checkbox", icon: CheckSquare, isLocked: false },
    { type: "radio", label: "Radio Button", icon: CircleDot, isLocked: false },
    { type: "dropdown", label: "Dropdown", icon: ChevronDownSquare, isLocked: false },
    { type: "image", label: "Image Box", icon: ImageIcon, isLocked: false },
    { type: "attachment", label: "Attachment", icon: Paperclip, isLocked: true },
    { type: "signature", label: "Signature", icon: PenTool, isLocked: true },
    { type: "initials", label: "Initials", icon: Stamp, isLocked: false },
    { type: "date", label: "Date Signed", icon: Calendar, isLocked: false },
  ] as const;

  const handleAddField = (type: DocumentField["type"], label: string, isLocked: boolean) => {
    const newField: DocumentField = {
      id: `field-${Date.now()}`,
      type,
      label,
      x: Math.floor(20 + Math.random() * 40),
      y: Math.floor(25 + Math.random() * 40),
      width: type === "paragraph" ? 360 : 200,
      height: type === "paragraph" ? 80 : 34,
      fontSize: 14,
      value: type === "date" ? "2026-08-18" : `${label} Content`,
      isLocked,
    };
    setPlacedFields([...placedFields, newField]);
    setActiveFieldId(newField.id);
  };

  const handleRemoveField = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlacedFields(placedFields.filter((f) => f.id !== id));
    if (activeFieldId === id) setActiveFieldId(null);
  };

  // Dragging field around canvas
  const handleFieldMouseDown = (id: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isMoveHandle = target.closest(".move-handle");

    if (!isMoveHandle && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.closest(".resize-handle"))) {
      return;
    }

    e.stopPropagation();
    setActiveFieldId(id);

    const targetField = placedFields.find((f) => f.id === id);
    if (!targetField || !paperRef.current) return;

    const paperRect = paperRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startFieldX = targetField.x;
    const startFieldY = targetField.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = ((moveEvent.clientX - startX) / paperRect.width) * 100;
      const deltaY = ((moveEvent.clientY - startY) / paperRect.height) * 100;

      const newX = Math.max(0, Math.min(88, startFieldX + deltaX));
      const newY = Math.max(0, Math.min(94, startFieldY + deltaY));

      setPlacedFields((prev) =>
        prev.map((f) => (f.id === id ? { ...f, x: newX, y: newY } : f))
      );
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Resize width handler (Right Edge)
  const handleResizeWidthMouseDown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const targetField = placedFields.find((f) => f.id === id);
    if (!targetField) return;

    const startX = e.clientX;
    const startWidth = targetField.width || 200;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / (zoomLevel / 100);
      const newWidth = Math.max(80, Math.min(680, startWidth + deltaX));

      setPlacedFields((prev) =>
        prev.map((f) => (f.id === id ? { ...f, width: newWidth } : f))
      );
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Resize height handler (Bottom Edge)
  const handleResizeHeightMouseDown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const targetField = placedFields.find((f) => f.id === id);
    if (!targetField) return;

    const startY = e.clientY;
    const startHeight = targetField.height || 34;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = (moveEvent.clientY - startY) / (zoomLevel / 100);
      const newHeight = Math.max(16, Math.min(400, startHeight + deltaY));

      setPlacedFields((prev) =>
        prev.map((f) => (f.id === id ? { ...f, height: newHeight } : f))
      );
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Resize both width and height (Bottom-Right Corner)
  const handleResizeBothMouseDown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const targetField = placedFields.find((f) => f.id === id);
    if (!targetField) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = targetField.width || 200;
    const startHeight = targetField.height || 34;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / (zoomLevel / 100);
      const deltaY = (moveEvent.clientY - startY) / (zoomLevel / 100);
      const newWidth = Math.max(60, Math.min(680, startWidth + deltaX));
      const newHeight = Math.max(16, Math.min(400, startHeight + deltaY));

      setPlacedFields((prev) =>
        prev.map((f) => (f.id === id ? { ...f, width: newWidth, height: newHeight } : f))
      );
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Update field value
  const handleUpdateFieldValue = (id: string, newValue: string) => {
    setPlacedFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, value: newValue } : f))
    );
  };

  // Step Width helper
  const handleStepWidth = (id: string, delta: number) => {
    setPlacedFields((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, width: Math.max(50, (f.width || 200) + delta) } : f
      )
    );
  };

  // Step Height helper
  const handleStepHeight = (id: string, delta: number) => {
    setPlacedFields((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, height: Math.max(16, (f.height || 34) + delta) } : f
      )
    );
  };

  return (
    <div className="flex-1 bg-slate-200 flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Top Editor Toolbar */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-3 md:px-6 py-2 flex items-center justify-between shadow-2xs gap-2 overflow-x-auto">
        {/* Left Toolbar actions */}
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          <button
            onClick={() => setActiveView("dashboard")}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-slate-200 mx-0.5"></div>

          <button
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Thumbnails Grid View"
          >
            <Grid className="w-4 h-4" />
          </button>

          <button
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Print PDF"
          >
            <Printer className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-slate-200 mx-0.5"></div>

          <button
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-slate-200 mx-0.5"></div>

          <button
            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg font-semibold transition"
            title="Select & Move Tool"
          >
            <MousePointer className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-slate-200 mx-0.5"></div>

          {/* Text Formatting */}
          <button
            onClick={() => {
              const next = !isBold;
              setIsBold(next);
              if (activeFieldId) {
                setPlacedFields((prev) =>
                  prev.map((f) => (f.id === activeFieldId ? { ...f, isBold: next } : f))
                );
              }
            }}
            className={`p-1.5 rounded-lg transition ${
              isBold
                ? "bg-blue-100 text-blue-700 font-bold"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              const next = !isItalic;
              setIsItalic(next);
              if (activeFieldId) {
                setPlacedFields((prev) =>
                  prev.map((f) => (f.id === activeFieldId ? { ...f, isItalic: next } : f))
                );
              }
            }}
            className={`p-1.5 rounded-lg transition ${
              isItalic
                ? "bg-blue-100 text-blue-700 font-bold"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <Palette className="w-3.5 h-3.5 text-slate-500 ml-1" />
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => {
                const color = e.target.value;
                setSelectedColor(color);
                if (activeFieldId) {
                  setPlacedFields((prev) =>
                    prev.map((f) => (f.id === activeFieldId ? { ...f, color } : f))
                  );
                }
              }}
              className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
              title="Text Color"
            />
          </div>

          <select
            value={fontSize}
            onChange={(e) => {
              const size = e.target.value;
              setFontSize(size);
              const numSize = parseInt(size);
              if (activeFieldId) {
                setPlacedFields((prev) =>
                  prev.map((f) => (f.id === activeFieldId ? { ...f, fontSize: numSize } : f))
                );
              }
            }}
            className="text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
          >
            <option value="12px">12px</option>
            <option value="14px">14px</option>
            <option value="16px">16px</option>
            <option value="18px">18px</option>
            <option value="20px">20px</option>
          </select>

          <div className="h-4 w-[1px] bg-slate-200 mx-0.5"></div>

          <button
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          {/* End of Text formatting controls */}
        </div>

        {/* Far Right Toolbar Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Prominent Send Request Button */}
          <button
            onClick={() => {
              if (documentData) {
                documentData.placedFields = placedFields;
              }
              if (onOpenSendModal) onOpenSendModal();
            }}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold px-3.5 py-1.5 rounded-xl shadow-md shadow-emerald-600/30 transition transform hover:-translate-y-0.5 text-xs"
          >
            <Send className="w-4 h-4" />
            <span>Send Request</span>
          </button>

          <button
            className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Share Document"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Workspace Area (Left Tool Sidebar + Main Canvas) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Tool Sidebar (Hidden when document is completed) */}
        {!isCompletedDoc && (
          <aside className="w-60 bg-slate-100 border-r border-slate-200 p-3 overflow-y-auto flex flex-col gap-3 flex-shrink-0 select-none shadow-inner">
            <div className="px-1 pt-1 flex items-center justify-between">
              <span className="text-[11px] font-extrabold tracking-wider text-slate-400 uppercase">
                Document Blocks
              </span>
              <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded">
                Click to Add
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {buildingBlocks.map((block) => {
                const Icon = block.icon;
                return (
                  <button
                    key={block.type}
                    onClick={() =>
                      handleAddField(
                        block.type as DocumentField["type"],
                        block.label,
                        block.isLocked
                      )
                    }
                    className="group relative flex items-center justify-between p-2.5 bg-white hover:bg-blue-50/70 border border-slate-200/90 rounded-xl shadow-2xs hover:shadow-sm hover:border-blue-300 transition-all text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-slate-100 group-hover:bg-blue-600 group-hover:text-white rounded-lg text-slate-600 transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-700 group-hover:text-blue-600 transition-colors">
                        {block.label}
                      </span>
                    </div>

                    {block.isLocked ? (
                      <div
                        className="p-1 bg-amber-100 rounded-md text-amber-700"
                        title="Pro Feature"
                      >
                        <Lock className="w-3 h-3 fill-amber-400 text-amber-600" />
                      </div>
                    ) : (
                      <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-auto pt-4 border-t border-slate-200 text-center">
              <p className="text-[11px] text-slate-400 font-medium">
                Click any element to insert. Drag to move, pull right/bottom edges to resize width & height!
              </p>
            </div>
          </aside>
        )}

        {/* Main Canvas Area */}
        <main className="flex-1 bg-slate-200/80 overflow-auto p-4 md:p-8 flex flex-col items-center gap-6 relative select-none">
          {/* Header Document Metadata Outside Paper Container */}
          <div className="w-[794px] max-w-full bg-white rounded-2xl border border-slate-300 p-4 md:p-5 shadow-sm flex justify-between items-center gap-4">
            <div className="min-w-0 flex-1">
              {isCompletedDoc ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white font-extrabold text-xs rounded-lg mb-2 shadow-sm">
                  <Lock className="w-3.5 h-3.5" />
                  <span>🔒 Completed & Legally Signed (Read-Only Locked)</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600 font-bold text-xs uppercase tracking-widest mb-1">
                  <FileText className="w-4 h-4 flex-shrink-0" /> Uploaded Document Preview
                </div>
              )}
              <h1 className="text-base md:text-lg font-bold text-slate-900 truncate max-w-xl" title={documentData?.name}>
                {documentData?.name || "Uploaded Document"}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <span>ID: DH-2026-{documentData?.id ? documentData.id.slice(-6) : "884920"}</span>
                <span>•</span>
                <span>{documentData?.size || "1.2 MB"}</span>
                <span>•</span>
                <span>{pageCount} page(s)</span>
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">
                <Check className="w-3.5 h-3.5 stroke-[3]" /> DocHub Verified
              </div>
            </div>
          </div>

          {/* A4 Paper Container - 1:1 Canvas Geometry */}
          <div
            className="flex justify-center transition-all duration-200 flex-shrink-0 mx-auto"
            style={{
              width: `${794 * (zoomLevel / 100)}px`,
              minHeight: "auto",
            }}
          >
            <div
              ref={paperRef}
              onClick={() => setActiveFieldId(null)}
              className="relative bg-white shadow-2xl rounded-lg overflow-hidden transition-transform duration-200 text-slate-800 font-sans border border-slate-300 flex-shrink-0"
              style={{
                width: "794px",
                minHeight: "auto",
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: "top center",
              }}
            >
                  {/* Render Actual Uploaded File Content */}
                  {activeFileUrl ? (
                    isImageDoc ? (
                      <div className="relative w-full z-0 bg-white">
                        <img
                          src={activeFileUrl}
                          alt={docTitle}
                          className="w-full h-auto block select-none pointer-events-none"
                        />
                      </div>
                    ) : (
                      <div className="relative w-full z-0 bg-white overflow-hidden min-h-[600px]">
                        <iframe
                          src={`${activeFileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                          className="w-full min-h-[750px] border-0 pointer-events-auto block"
                          style={{ width: "100%", height: "750px", border: 0, margin: 0, padding: 0 }}
                          title={docTitle}
                        />
                      </div>
                    )
                ) : (
                  <div className="w-full h-full min-h-[600px] bg-slate-50/60 p-8 flex flex-col items-center justify-center text-center">
                    <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl mb-4">
                      <FileText className="w-12 h-12" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 max-w-lg truncate mb-2">
                      {documentData?.name || "Uploaded Document File"}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mb-6">
                      Document is loaded and ready for editing, form field placement, and e-signatures.
                    </p>
                    <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-2xs">
                      <span>Format: PDF</span>
                      <span>•</span>
                      <span>Size: {documentData?.size || "2.4 MB"}</span>
                      <span>•</span>
                      <span>Pages: {pageCount}</span>
                    </div>
                  </div>
                )}

              {/* Precise Draggable & Resizable Placed Fields */}
              {placedFields.map((field) => {
                const isActive = activeFieldId === field.id;
                const fieldWidth = field.width || 200;
                const fieldHeight = field.height || 34;

                return (
                  <div
                    key={field.id}
                    onMouseDown={(e) => !isCompletedDoc && handleFieldMouseDown(field.id, e)}
                    className={`absolute group/field transition-shadow rounded flex flex-col justify-center select-none ${
                      isCompletedDoc
                        ? "border-0 bg-transparent z-20 pointer-events-none"
                        : isActive
                        ? "ring-2 ring-blue-500 bg-blue-50/90 border border-blue-500 z-30 shadow-md"
                        : "bg-blue-50/50 hover:bg-blue-50/80 border border-blue-400/80 z-10"
                    }`}
                    style={{
                      left: `${field.x}%`,
                      top: `${field.y}%`,
                      width: `${fieldWidth}px`,
                      height: `${fieldHeight}px`,
                    }}
                  >
                    {/* Outside Top Label Pill Tag (Only in editing mode) */}
                    {!isCompletedDoc && (
                      <div className="absolute -top-5 left-0 flex items-center gap-1 bg-slate-900 text-white rounded px-1.5 py-0.5 text-[9px] font-bold shadow z-40 pointer-events-none whitespace-nowrap opacity-95">
                        <GripVertical className="w-2.5 h-2.5 text-blue-400" />
                        <span>{field.label}</span>
                        {field.isLocked && <Lock className="w-2.5 h-2.5 text-amber-400 fill-amber-300" />}
                      </div>
                    )}

                    {/* Floating Active Field Toolbar Overlay (Only in editing mode) */}
                    {isActive && !isCompletedDoc && (
                      <div className="absolute -top-11 right-0 bg-slate-900 text-white rounded-xl px-2.5 py-1 flex items-center gap-2 text-[10px] shadow-xl z-50 animate-in fade-in whitespace-nowrap border border-slate-700">
                        {/* Prominent Move Handle Button */}
                        <div
                          onMouseDown={(e) => handleFieldMouseDown(field.id, e)}
                          className="move-handle flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-2 py-0.5 rounded cursor-grab active:cursor-grabbing shadow-xs transition"
                          title="Click & Drag to move this field"
                        >
                          <Move className="w-3.5 h-3.5" />
                          <span>Move</span>
                        </div>

                        {(field.type === "image" || field.type === "attachment") && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const fileInput = document.createElement("input");
                              fileInput.type = "file";
                              fileInput.accept = "image/*,.pdf";
                              fileInput.onchange = (evt: any) => {
                                const file = evt.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    handleUpdateFieldValue(field.id, reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              };
                              fileInput.click();
                            }}
                            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-0.5 rounded transition"
                            title="Upload Image or PDF"
                          >
                            <Upload className="w-3 h-3" />
                            <span>Upload File</span>
                          </button>
                        )}

                        <div className="h-3.5 w-[1px] bg-slate-700"></div>

                        {/* Width adjustment */}
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-medium">Width:</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStepWidth(field.id, -20);
                            }}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded font-bold transition"
                          >
                            -
                          </button>
                          <span className="font-mono text-white font-semibold">{fieldWidth}px</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStepWidth(field.id, 20);
                            }}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded font-bold transition"
                          >
                            +
                          </button>
                        </div>

                        <div className="h-3.5 w-[1px] bg-slate-700"></div>

                        {/* Height adjustment */}
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-medium">Height:</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStepHeight(field.id, -4);
                            }}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded font-bold transition"
                            title="Decrease height"
                          >
                            -
                          </button>
                          <span className="font-mono text-white font-semibold">{fieldHeight}px</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStepHeight(field.id, 4);
                            }}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded font-bold transition"
                            title="Increase height"
                          >
                            +
                          </button>
                        </div>

                        <div className="h-3.5 w-[1px] bg-slate-700"></div>

                        {/* Font Size adjustment */}
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-medium">Font:</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentSize = field.fontSize || 14;
                              const newSize = Math.max(10, currentSize - 2);
                              setPlacedFields((prev) =>
                                prev.map((f) => (f.id === field.id ? { ...f, fontSize: newSize } : f))
                              );
                            }}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded font-bold transition"
                          >
                            -
                          </button>
                          <span className="font-mono text-white font-semibold">{field.fontSize || 14}px</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentSize = field.fontSize || 14;
                              const newSize = Math.min(32, currentSize + 2);
                              setPlacedFields((prev) =>
                                prev.map((f) => (f.id === field.id ? { ...f, fontSize: newSize } : f))
                              );
                            }}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded font-bold transition"
                          >
                            +
                          </button>
                        </div>

                        <div className="h-3.5 w-[1px] bg-slate-700"></div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={(e) => handleRemoveField(field.id, e)}
                          className="bg-red-600 hover:bg-red-700 text-white p-1 rounded transition"
                          title="Delete Field"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Inline Content Box */}
                    <div className="w-full h-full flex items-center px-1.5 overflow-hidden">
                      {field.type === "text" ? (
                        <input
                          type="text"
                          readOnly={isCompletedDoc}
                          value={field.value || ""}
                          onChange={(e) => handleUpdateFieldValue(field.id, e.target.value)}
                          onFocus={() => setActiveFieldId(field.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFieldId(field.id);
                          }}
                          placeholder="Type text..."
                          className={`w-full h-full bg-transparent border-0 focus:outline-none focus:ring-0 text-slate-900 ${
                            field.isBold ? "font-bold" : "font-normal"
                          } ${field.isItalic ? "italic" : ""}`}
                          style={{
                            fontSize: `${field.fontSize || 14}px`,
                            color: field.color || selectedColor,
                          }}
                        />
                      ) : field.type === "paragraph" ? (
                        <textarea
                          readOnly={isCompletedDoc}
                          value={field.value || ""}
                          onChange={(e) => handleUpdateFieldValue(field.id, e.target.value)}
                          onFocus={() => setActiveFieldId(field.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFieldId(field.id);
                          }}
                          placeholder="Type paragraph text..."
                          className={`w-full h-full bg-transparent border-0 focus:outline-none focus:ring-0 resize-none text-slate-900 ${
                            field.isBold ? "font-bold" : "font-normal"
                          } ${field.isItalic ? "italic" : ""}`}
                          style={{
                            fontSize: `${field.fontSize || 14}px`,
                            color: field.color || selectedColor,
                          }}
                        />
                      ) : field.type === "signature" ? (
                        <div
                          onClick={() => setActiveFieldId(field.id)}
                          className="w-full h-full flex items-center justify-between px-2 bg-blue-50/30 cursor-pointer"
                        >
                          {field.value && field.value.startsWith("data:image") ? (
                            <img
                              src={field.value}
                              alt="Drawn Signature"
                              className="max-h-full max-w-full object-contain mx-auto pointer-events-none"
                            />
                          ) : (
                            <span className="font-serif italic text-blue-800 text-sm font-bold truncate">
                              {field.value || "Sign Here ✍️"}
                            </span>
                          )}
                        </div>
                      ) : field.type === "date" ? (
                        <input
                          type="date"
                          readOnly={isCompletedDoc}
                          value={field.value || new Date().toISOString().split("T")[0]}
                          onChange={(e) => handleUpdateFieldValue(field.id, e.target.value)}
                          onFocus={() => setActiveFieldId(field.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFieldId(field.id);
                            if (!isCompletedDoc && "showPicker" in e.currentTarget) {
                              try {
                                (e.currentTarget as any).showPicker();
                              } catch {}
                            }
                          }}
                          className="w-full h-full bg-transparent border-0 focus:outline-none font-mono text-xs text-slate-800 font-semibold cursor-pointer"
                        />
                      ) : field.type === "checkbox" ? (
                        <label
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFieldId(field.id);
                          }}
                          className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-800 w-full"
                        >
                          <input
                            type="checkbox"
                            defaultChecked
                            className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 flex-shrink-0"
                          />
                          <input
                            type="text"
                            value={field.value || "Checkbox option"}
                            onChange={(e) => handleUpdateFieldValue(field.id, e.target.value)}
                            onFocus={() => setActiveFieldId(field.id)}
                            className="bg-transparent border-0 focus:outline-none text-xs text-slate-800 font-semibold w-full"
                          />
                        </label>
                      ) : field.type === "image" || field.type === "attachment" ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFieldId(field.id);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (!isCompletedDoc) {
                              const fileInput = document.createElement("input");
                              fileInput.type = "file";
                              fileInput.accept = "image/*,.pdf";
                              fileInput.onchange = (evt: any) => {
                                const file = evt.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    handleUpdateFieldValue(field.id, reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              };
                              fileInput.click();
                            }
                          }}
                          className="w-full h-full flex items-center justify-center p-1 bg-slate-50/80 hover:bg-slate-100/90 cursor-move border border-dashed border-blue-400 rounded overflow-hidden select-none"
                        >
                          {field.value ? (
                            field.value.startsWith("data:image") ? (
                              <img
                                src={field.value}
                                alt="Uploaded Box Attachment"
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
                              <Upload className="w-3.5 h-3.5" /> Upload Image / PDF
                            </span>
                          )}
                        </div>
                      ) : (
                        <span
                          onClick={() => setActiveFieldId(field.id)}
                          className="text-xs font-medium text-slate-800 truncate cursor-pointer"
                        >
                          {field.value || field.label}
                        </span>
                      )}
                    </div>

                    {/* Right Edge Handle (Width Resize) */}
                    {isActive && !isCompletedDoc && (
                      <div
                        onMouseDown={(e) => handleResizeWidthMouseDown(field.id, e)}
                        className="resize-handle absolute top-0 bottom-0 -right-1.5 w-3 bg-blue-600 hover:bg-blue-700 rounded-r cursor-ew-resize flex items-center justify-center z-40"
                        title="Drag right edge to change width"
                      />
                    )}

                    {/* Bottom Edge Handle (Height Resize) */}
                    {isActive && !isCompletedDoc && (
                      <div
                        onMouseDown={(e) => handleResizeHeightMouseDown(field.id, e)}
                        className="resize-handle absolute left-0 right-0 -bottom-1.5 h-3 bg-blue-600 hover:bg-blue-700 rounded-b cursor-ns-resize flex items-center justify-center z-40"
                        title="Drag bottom edge to change height"
                      />
                    )}

                    {/* Bottom-Right Corner Handle (Both Width & Height Resize) */}
                    {isActive && !isCompletedDoc && (
                      <div
                        onMouseDown={(e) => handleResizeBothMouseDown(field.id, e)}
                        className="resize-handle absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-blue-700 hover:bg-blue-800 rounded-full border-2 border-white cursor-nwse-resize z-50 shadow-sm"
                        title="Drag corner to change both width & height"
                      />
                    )}
                  </div>
                );
              })}

            {/* Footer page number indicator */}
            <div className="absolute bottom-4 left-12 right-12 flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-100 pt-2">
              <span>DocHub Secure Document Stream</span>
              <span>Page 1 of {pageCount}</span>
            </div>
          </div>
          </div>

          {/* Floating Zoom & Page Controls Bar */}
          <div className="fixed bottom-6 right-8 z-30 bg-slate-900 text-white rounded-xl px-3 py-2 flex items-center gap-3 shadow-xl border border-slate-700">
            <button
              onClick={() => setZoomLevel(Math.max(60, zoomLevel - 10))}
              className="p-1 hover:bg-slate-800 rounded transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold min-w-[40px] text-center">
              {zoomLevel}%
            </span>
            <button
              onClick={() => setZoomLevel(Math.min(150, zoomLevel + 10))}
              className="p-1 hover:bg-slate-800 rounded transition"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="h-4 w-[1px] bg-slate-700"></div>
            <span className="text-xs text-slate-300">Page 1 / {pageCount}</span>
          </div>
        </main>
      </div>
    </div>
  );
};
