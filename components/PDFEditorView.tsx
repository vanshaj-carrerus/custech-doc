"use client";

import React, { useState, useRef, useEffect } from "react";
import { ActiveView, DocumentField, ActiveDocument, UserSession } from "@/types/dochub";
import { getPdfLayoutInfo, getPdfjsLib, toUint8Array } from "@/lib/pdfUtils";
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
  GripVertical,
  Check,
  FileText,
  Move,
  Send,
  Loader2,
  Mail,
  MailOpen,
  Plus,
} from "lucide-react";

interface PDFEditorViewProps {
  setActiveView: (view: ActiveView) => void;
  onOpenWalkthrough: () => void;
  onOpenSendModal?: () => void;
  onCreateNewDocument?: () => void;
  documentData?: ActiveDocument;
  userSession?: UserSession;
}

export const PDFEditorView: React.FC<PDFEditorViewProps> = ({
  setActiveView,
  onOpenWalkthrough,
  onOpenSendModal,
  onCreateNewDocument,
  documentData,
  userSession,
}) => {
  const isSignedComplete =
    documentData?.status === "Completed" ||
    (typeof window !== "undefined" &&
      (!documentData || !documentData.status) &&
      !!localStorage.getItem("dochub_completed_fields"));
  const isPendingSent =
    !isSignedComplete &&
    (documentData?.status === "Pending Sign" || !!documentData?.recipientEmail);
  const isCompletedDoc = isSignedComplete || isPendingSent;

  const [emailOpened, setEmailOpened] = useState(!!documentData?.emailOpened);
  const [emailOpenedAt, setEmailOpenedAt] = useState(documentData?.emailOpenedAt || "");

  useEffect(() => {
    setEmailOpened(!!documentData?.emailOpened);
    setEmailOpenedAt(documentData?.emailOpenedAt || "");
  }, [documentData?.id, documentData?.emailOpened, documentData?.emailOpenedAt]);

  useEffect(() => {
    if (!isPendingSent || !documentData?.id) return;

    const loadOpenStatus = () => {
      fetch(`/api/documents?id=${encodeURIComponent(documentData.id)}`)
        .then((res) => res.json())
        .then((data) => {
          const found = data.documents?.[0];
          if (!found) return;
          setEmailOpened(!!(found.emailOpened || found.emailOpenedAt || found.emailClickedAt));
          setEmailOpenedAt(found.lastEmailOpenedAt || found.emailOpenedAt || "");
        })
        .catch(() => {});
    };

    loadOpenStatus();
    const poll = window.setInterval(loadOpenStatus, 10000);
    return () => window.clearInterval(poll);
  }, [isPendingSent, documentData?.id]);

  // Paper canvas ref for position calculations
  const paperRef = useRef<HTMLDivElement>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);

  // Formatting state
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#1e293b");
  const [fontSize, setFontSize] = useState("14px");
  const [showSignDropdown, setShowSignDropdown] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [detectedPages, setDetectedPages] = useState<number | null>(null);
  const [detectedPageHeightPx, setDetectedPageHeightPx] = useState<number | null>(null);

  const sidebarFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const activeFileUrl =
      documentData?.fileUrl ||
      (typeof window !== "undefined"
        ? localStorage.getItem("dochub_pdf_data") || sessionStorage.getItem("dochub_active_fileUrl")
        : null);

    if (activeFileUrl) {
      getPdfLayoutInfo(activeFileUrl).then(({ pageCount, pageHeightPx }) => {
        setDetectedPages(pageCount);
        setDetectedPageHeightPx(pageHeightPx);
      });
    } else if (documentData?.pages) {
      setDetectedPages(documentData.pages);
    }
  }, [documentData?.id, documentData?.fileUrl]);

  // Route pinch-to-zoom / Ctrl+scroll on the canvas into the shared zoomLevel state,
  // so the document and every placed field (name, date, signature) zoom together as one.
  useEffect(() => {
    const el = canvasScrollRef.current;
    if (!el) return;

    const handleWheelZoom = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = Math.max(-15, Math.min(15, e.deltaY));
      setZoomLevel((prev) => Math.max(60, Math.min(150, prev - delta)));
    };

    el.addEventListener("wheel", handleWheelZoom, { passive: false });
    return () => el.removeEventListener("wheel", handleWheelZoom);
  }, []);

  const pageCount = Math.max(1, detectedPages || documentData?.pages || 1);
  const pageHeightPx = detectedPageHeightPx || 1050;
  const canvasMinHeightPx = pageCount * pageHeightPx;
  const iframeHeightPx = canvasMinHeightPx;

  const activeFileUrl = documentData?.fileUrl || (typeof window !== "undefined" ? localStorage.getItem("dochub_pdf_data") || sessionStorage.getItem("dochub_active_fileUrl") : null);
  const activeFileType = documentData?.fileType || (typeof window !== "undefined" ? localStorage.getItem("dochub_pdf_type") || sessionStorage.getItem("dochub_active_fileType") : null);
  const docTitle = documentData?.name || (typeof window !== "undefined" ? localStorage.getItem("dochub_pdf_name") : null) || "Document.pdf";
  const isImageDoc = !!(activeFileType?.includes("image") || activeFileUrl?.startsWith("data:image/"));
  const [renderedPdfPages, setRenderedPdfPages] = useState<string[]>([]);
  const [isRenderingPdf, setIsRenderingPdf] = useState(false);

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

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: 794 / baseViewport.width });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d");
          if (!context) continue;

          await page.render({ canvas, canvasContext: context, viewport }).promise;
          images.push(canvas.toDataURL("image/jpeg", 0.92));
        }

        if (!cancelled) setRenderedPdfPages(images);
      } catch (error) {
        console.warn("PDF editor rendering failed:", error);
      } finally {
        if (!cancelled) setIsRenderingPdf(false);
      }
    };

    void renderPages();
    return () => {
      cancelled = true;
    };
  }, [activeFileUrl, isImageDoc]);

  // Placed interactive document fields on the A4 page
  const [placedFields, setPlacedFields] = useState<DocumentField[]>(() => {
    if (documentData?.filledFields && documentData.filledFields.length > 0) {
      return documentData.filledFields;
    }
    if (Array.isArray(documentData?.placedFields)) {
      return documentData.placedFields;
    }
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
    return [];
  });

  useEffect(() => {
    if (documentData?.filledFields && documentData.filledFields.length > 0) {
      setPlacedFields(documentData.filledFields);
      return;
    }
    if (Array.isArray(documentData?.placedFields)) {
      setPlacedFields(
        documentData.status === "Draft"
          ? documentData.placedFields.filter((field) => !field.id.startsWith("auto-"))
          : documentData.placedFields
      );
    }
  }, [documentData?.id, documentData?.status]);

  useEffect(() => {
    if (documentData?.status === "Draft") {
      setPlacedFields((fields) => fields.filter((field) => !field.id.startsWith("auto-")));
    }
  }, [documentData?.id, documentData?.status]);

  useEffect(() => {
    if (typeof window !== "undefined" && placedFields.length > 0) {
      localStorage.setItem("dochub_placed_fields", JSON.stringify(placedFields));
    }
  }, [placedFields]);

  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

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
    { type: "date", label: "Date Signed", icon: Calendar, isLocked: false },
  ] as const;

  const handleAddField = (
    type: DocumentField["type"],
    label: string,
    isLocked: boolean,
    dropX?: number,
    dropY?: number
  ) => {
    const width = type === "paragraph" ? 360 : 200;
    const height = type === "paragraph" ? 80 : type === "radio" ? 70 : 34;
    const hasDropPosition = dropX !== undefined && dropY !== undefined;

    const newField: DocumentField = {
      id: `field-${Date.now()}`,
      type,
      label,
      x: hasDropPosition ? Math.max(0, Math.min(88, dropX!)) : Math.floor(20 + Math.random() * 40),
      y: hasDropPosition ? Math.max(0, Math.min(94, dropY!)) : Math.floor(25 + Math.random() * 40),
      width,
      height,
      fontSize: 14,
      value: type === "date" ? "2026-08-18" : "",
      options: type === "radio" || type === "dropdown" ? ["Option 1", "Option 2"] : undefined,
      isLocked,
    };
    setPlacedFields([...placedFields, newField]);
    setActiveFieldId(newField.id);

    // A random (click-to-add) position can land outside the current scroll position
    // on a long document, making the new field invisible until the user scrolls
    // manually — bring it into view so it's actually seen right away. A drag-and-drop
    // placement is already visible where the user dropped it, so skip the jump there.
    if (!hasDropPosition) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = paperRef.current?.querySelector(`[data-field-id="${newField.id}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      });
    }
  };

  // Adds a file picked from the sidebar's Upload button as a new Image Box
  // element placed on the document — it does not touch the base PDF/image
  // being edited, it just adds another element on top of it.
  const handleSidebarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newField: DocumentField = {
        id: `field-${Date.now()}`,
        type: "image",
        label: "Image Box",
        x: Math.floor(20 + Math.random() * 40),
        y: Math.floor(25 + Math.random() * 40),
        width: 220,
        height: 160,
        fontSize: 14,
        value: dataUrl,
        isLocked: false,
        // Media added via this sidebar button is recruiter-authored content on
        // the document, not a field the candidate is meant to fill/replace.
        candidateLocked: true,
      };
      setPlacedFields((prev) => [...prev, newField]);
      setActiveFieldId(newField.id);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = paperRef.current?.querySelector(`[data-field-id="${newField.id}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      });
    };
    reader.readAsDataURL(selectedFile);
    e.target.value = "";
  };

  // Drag-and-drop of a block from the sidebar onto the PDF canvas
  const handleBlockDragStart = (
    e: React.DragEvent,
    type: DocumentField["type"],
    label: string,
    isLocked: boolean
  ) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("application/json", JSON.stringify({ type, label, isLocked }));
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/json");
    if (!raw || !paperRef.current) return;

    let block: { type: DocumentField["type"]; label: string; isLocked: boolean };
    try {
      block = JSON.parse(raw);
    } catch {
      return;
    }

    const rect = paperRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    handleAddField(block.type, block.label, block.isLocked, xPct, yPct);
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
    const zoomScale = zoomLevel / 100;
    const paperWidth = paperRect.width / zoomScale;
    const paperHeight = paperRect.height / zoomScale;
    const maxX = Math.max(
      0,
      100 - ((targetField.width || 200) / paperWidth) * 100
    );
    const maxY = Math.max(
      0,
      100 - ((targetField.height || 34) / paperHeight) * 100
    );

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = ((moveEvent.clientX - startX) / paperRect.width) * 100;
      const deltaY = ((moveEvent.clientY - startY) / paperRect.height) * 100;

      const newX = Math.max(0, Math.min(maxX, startFieldX + deltaX));
      const newY = Math.max(0, Math.min(maxY, startFieldY + deltaY));

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

  const handleUpdateRadioOption = (id: string, index: number, text: string) => {
    setPlacedFields((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const options = [...(f.options || [])];
        options[index] = text;
        return { ...f, options };
      })
    );
  };

  const handleAddRadioOption = (id: string) => {
    setPlacedFields((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, options: [...(f.options || []), `Option ${(f.options?.length || 0) + 1}`] }
          : f
      )
    );
  };

  const handleRemoveRadioOption = (id: string, index: number) => {
    setPlacedFields((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, options: (f.options || []).filter((_, i) => i !== index) } : f
      )
    );
  };

  // Step Width helper — scales font size proportionally with width so text keeps fitting the field
  const handleStepWidth = (id: string, delta: number) => {
    setPlacedFields((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const currentWidth = f.width || 200;
        const currentFontSize = f.fontSize || 14;
        const newWidth = Math.max(50, currentWidth + delta);
        const scale = newWidth / currentWidth;
        const newFontSize = Math.min(32, Math.max(10, Math.round(currentFontSize * scale)));
        return { ...f, width: newWidth, fontSize: newFontSize };
      })
    );
  };

  // Step Height helper — scales font size proportionally with height so text keeps fitting the field
  const handleStepHeight = (id: string, delta: number) => {
    setPlacedFields((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const currentHeight = f.height || 34;
        const currentFontSize = f.fontSize || 14;
        const newHeight = Math.max(16, currentHeight + delta);
        const scale = newHeight / currentHeight;
        const newFontSize = Math.min(32, Math.max(10, Math.round(currentFontSize * scale)));
        return { ...f, height: newHeight, fontSize: newFontSize };
      })
    );
  };

  const [isDownloading, setIsDownloading] = useState(false);

  // Builds a real downloadable PDF from the source document with every placed
  // field's current value (text, checkbox, signature image) drawn onto the
  // matching page, at the position/size it has in the on-screen editor.
  const handleDownloadPdf = async () => {
    if (!activeFileUrl || isDownloading) return;
    setIsDownloading(true);
    try {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

      let pdfDoc;
      if (isImageDoc) {
        const imgBytes = await (await fetch(activeFileUrl)).arrayBuffer();
        pdfDoc = await PDFDocument.create();
        const img = activeFileUrl.includes("image/png")
          ? await pdfDoc.embedPng(imgBytes)
          : await pdfDoc.embedJpg(imgBytes);
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      } else {
        const pdfBytes = await (await fetch(activeFileUrl)).arrayBuffer();
        pdfDoc = await PDFDocument.load(pdfBytes);
      }

      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pages = pdfDoc.getPages();
      const renderWidthPx = 794;
      const totalHeightPx = pageCount * pageHeightPx;

      // Standard PDF fonts only support WinAnsi (Latin-1) characters — strip anything
      // outside that range (emoji, etc.) so one odd character can't break the export.
      const toWinAnsiSafe = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

      for (const field of placedFields) {
        try {
          const absYpx = (field.y / 100) * totalHeightPx;
          const pageIndex = Math.min(pages.length - 1, Math.floor(absYpx / pageHeightPx));
          const withinPageYpx = absYpx - pageIndex * pageHeightPx;
          const pdfPage = pages[pageIndex];
          const scale = pdfPage.getWidth() / renderWidthPx;

          const xPt = (field.x / 100) * pdfPage.getWidth();
          const wPt = (field.width || 200) * scale;
          const hPt = (field.height || 34) * scale;
          const topYPt = pdfPage.getHeight() - withinPageYpx * scale;
          const bottomYPt = topYPt - hPt;

          if (field.type === "signature") {
            if (field.value?.startsWith("data:image")) {
              const sigBytes = await (await fetch(field.value)).arrayBuffer();
              const sigImg = field.value.includes("image/png")
                ? await pdfDoc.embedPng(sigBytes)
                : await pdfDoc.embedJpg(sigBytes);
              pdfPage.drawImage(sigImg, { x: xPt, y: bottomYPt, width: wPt, height: hPt });
            } else if (field.value) {
              pdfPage.drawText(toWinAnsiSafe(field.value), {
                x: xPt + 2,
                y: bottomYPt + hPt * 0.3,
                size: Math.min(18, hPt * 0.6),
                font,
                color: rgb(0.05, 0.15, 0.55),
              });
            }
          } else if (field.type === "checkbox") {
            pdfPage.drawText(toWinAnsiSafe(`[X] ${field.value || ""}`), {
              x: xPt + 2,
              y: bottomYPt + hPt * 0.3,
              size: Math.min(12, hPt * 0.5),
              font,
              color: rgb(0.1, 0.1, 0.1),
            });
          } else if (field.type === "image" || field.type === "attachment") {
            if (field.value?.startsWith("data:image")) {
              const imgBytes2 = await (await fetch(field.value)).arrayBuffer();
              const embedded = field.value.includes("image/png")
                ? await pdfDoc.embedPng(imgBytes2)
                : await pdfDoc.embedJpg(imgBytes2);
              pdfPage.drawImage(embedded, { x: xPt, y: bottomYPt, width: wPt, height: hPt });
            }
          } else if (field.value) {
            pdfPage.drawText(toWinAnsiSafe(String(field.value)), {
              x: xPt + 2,
              y: bottomYPt + hPt * 0.3,
              size: Math.min((field.fontSize || 14) * scale, hPt * 0.75),
              font,
              color: rgb(0.1, 0.1, 0.1),
            });
          }
        } catch (fieldErr) {
          console.warn(`Skipping field "${field.label}" in PDF export:`, fieldErr);
        }
      }

      const outBytes = await pdfDoc.save();
      const blob = new Blob([outBytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docTitle.replace(/\.pdf$/i, "")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate PDF download:", err);
      alert("Couldn't generate the PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
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

          {/* Hidden on completed/signed documents — nothing here is editable once a doc is locked */}
          {!isCompletedDoc && (
            <>
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
            </>
          )}
        </div>

        {/* Far Right Toolbar Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Prominent Send Request Button — hidden once the doc is already completed/signed */}
          {!isCompletedDoc && (
            <button
              onClick={() => {
                if (documentData) {
                  documentData.placedFields = placedFields;
                }
                if (onOpenSendModal) onOpenSendModal();
              }}
              className="flex items-center gap-1.5 bg-secondary hover:bg-secondary/90 active:bg-secondary text-white font-extrabold px-3.5 py-1.5 rounded-xl shadow-md shadow-secondary/30 transition transform hover:-translate-y-0.5 text-xs"
            >
              <Send className="w-4 h-4" />
              <span>Send Request</span>
            </button>
          )}

          {isCompletedDoc && (
            <button
              onClick={() => {
                if (onCreateNewDocument) onCreateNewDocument();
                else setActiveView("import");
              }}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white font-extrabold px-3.5 py-1.5 rounded-xl shadow-md shadow-primary/20 transition transform hover:-translate-y-0.5 text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>New Document</span>
            </button>
          )}

          <button
            onClick={handleDownloadPdf}
            disabled={!activeFileUrl || isDownloading}
            className="p-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition"
            title={activeFileUrl ? "Download PDF" : "Upload a document first"}
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>

        </div>
      </div>

      {/* Main Workspace Area (Left Tool Sidebar + Main Canvas) */}
      <div className="flex-1 relative flex overflow-y-auto h-full min-h-0">
        {/* Left Tool Sidebar (Hidden when document is completed) */}
        {!isCompletedDoc && (
          <aside className="sticky! top-0 z-20! h-full self-start max-h-[calc(100vh-64px)] w-60 bg-slate-100 border-r border-slate-200 p-3 overflow-y-auto flex flex-col gap-3 flex-shrink-0 select-none shadow-inner">
            <div className="px-1 pt-1 flex items-center justify-between">
              <span className="text-[11px] font-extrabold tracking-wider text-slate-400 uppercase">
                Document Blocks
              </span>
              <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded">
                Click to Add
              </span>
            </div>

            <input
              type="file"
              ref={sidebarFileInputRef}
              onChange={handleSidebarFileUpload}
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => sidebarFileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 w-full px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
            >
              <Upload className="w-4 h-4" />
              <span>Upload</span>
            </button>

            <div className="sticky! top-0! z-10! grid grid-cols-1 gap-2">
              {buildingBlocks.map((block) => {
                const Icon = block.icon;
                return (
                  <button
                    key={block.type}
                    draggable
                    onDragStart={(e) =>
                      handleBlockDragStart(
                        e,
                        block.type as DocumentField["type"],
                        block.label,
                        block.isLocked
                      )
                    }
                    onClick={() =>
                      handleAddField(
                        block.type as DocumentField["type"],
                        block.label,
                        block.isLocked
                      )
                    }
                    className="group relative flex items-center justify-between p-2.5 bg-white hover:bg-blue-50/70 border border-slate-200/90 rounded-xl shadow-2xs hover:shadow-sm hover:border-blue-300 transition-all text-left cursor-grab active:cursor-grabbing"
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
                Click to insert, or drag a block onto the document to place it exactly. Drag a placed field to move it, pull right/bottom edges to resize.
              </p>
            </div>
          </aside>
        )}

        {/* Main Canvas Area */}
        <main
          ref={canvasScrollRef}
          className="flex-1 bg-slate-200/80 p-4 md:p-8 flex flex-col items-center gap-6 relative select-none"
        >
          {/* Header Document Metadata Outside Paper Container */}
          <div className="w-[794px] max-w-full bg-white rounded-2xl border border-slate-300 p-4 md:p-5 shadow-sm flex justify-between items-center gap-4">
            <div className="min-w-0 flex-1">
              {isSignedComplete ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary text-white font-extrabold text-xs rounded-lg mb-2 shadow-sm">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Completed & Legally Signed (Read-Only Locked)</span>
                </div>
              ) : isPendingSent ? (
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-white font-extrabold text-xs rounded-lg mb-2 shadow-sm">
                    <Lock className="w-3.5 h-3.5" />
                    <span>
                      Already sent to {documentData?.recipientEmail || "a candidate"} — upload a new document to send to someone else
                    </span>
                  </div>
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ml-2 ${
                      emailOpened
                        ? "bg-secondary/10 text-secondary border border-secondary/20"
                        : "bg-slate-100 text-slate-500 border border-slate-200"
                    }`}
                  >
                    {emailOpened ? (
                      <>
                        <MailOpen className="w-3.5 h-3.5" />
                        <span>Email opened{emailOpenedAt ? ` · ${new Date(emailOpenedAt).toLocaleString()}` : ""}</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5" />
                        <span>Email not opened yet</span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600 font-bold text-xs uppercase tracking-widest mb-1">
                  <FileText className="w-4 h-4 flex-shrink-0" /> Uploaded Document Preview
                </div>
              )}
              <h1 className="text-base md:text-lg font-bold text-slate-900 truncate max-w-xl" title={docTitle}>
                {docTitle}
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
                <Check className="w-3.5 h-3.5 stroke-[3]" /> CUS-DOC Verified
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
              onDragOver={!isCompletedDoc ? handleCanvasDragOver : undefined}
              onDrop={!isCompletedDoc ? handleCanvasDrop : undefined}
              className="relative bg-white shadow-2xl rounded-lg transition-transform duration-200 text-slate-800 font-sans border border-slate-300 flex-shrink-0"
              style={{
                width: "794px",
                minHeight: "auto",
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: "top center",
              }}
            >
                  {/* Render Actual Uploaded File Content — clipped to the rounded corners on its own,
                      separately from the fields overlay below, so a field label/toolbar near the top
                      of the page isn't chopped off by this container's own rounding. */}
                  <div className="relative rounded-lg overflow-hidden">
                  {activeFileUrl ? (
                    isImageDoc ? (
                      <div className="relative w-full z-0 bg-white">
                        <img
                          src={activeFileUrl}
                          alt={docTitle}
                          className="w-full h-auto block select-none pointer-events-none"
                        />
                      </div>
                    ) : renderedPdfPages.length > 0 ? (
                      <div className="relative z-0 w-full bg-white">
                        {renderedPdfPages.map((pageImage, index) => (
                          <img
                            key={`${index}-${pageImage.length}`}
                            src={pageImage}
                            alt={`${docTitle} – page ${index + 1}`}
                            className="block h-auto w-full select-none pointer-events-none"
                          />
                        ))}
                      </div>
                    ) : isRenderingPdf ? (
                      <div
                        className="flex w-full items-center justify-center gap-2 bg-white text-sm font-semibold text-slate-500"
                        style={{ minHeight: `${Math.min(500, iframeHeightPx)}px` }}
                      >
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span>Rendering document...</span>
                      </div>
                    ) : (
                      <div className="relative w-full z-0 bg-white overflow-hidden" style={{ minHeight: `${iframeHeightPx}px` }}>
                        <iframe
                          src={`${activeFileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                          className="w-full border-0 pointer-events-none block"
                          style={{ width: "100%", height: `${iframeHeightPx}px`, border: 0, margin: 0, padding: 0 }}
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
                  </div>

              {/* Precise Draggable & Resizable Placed Fields */}
              {placedFields.map((field) => {
                const isActive = activeFieldId === field.id;
                const fieldWidth = field.width || 200;
                const fieldHeight = field.height || 34;

                return (
                  <div
                    key={field.id}
                    data-field-id={field.id}
                    onMouseDown={(e) => !isCompletedDoc && handleFieldMouseDown(field.id, e)}
                    className={`absolute group/field rounded-sm flex flex-col justify-center select-none ${
                      isCompletedDoc
                        ? "border-0 bg-transparent z-20 pointer-events-none"
                        : isActive
                        ? "border-0 bg-[#a5b4fc] z-30"
                        : "border-0 bg-[#c7d2fe] hover:bg-[#a5b4fc] z-10"
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
                    {/* Anchored to whichever side keeps it inside the paper bounds: fields on the left half grow the toolbar rightward, fields on the right half grow it leftward. */}
                    {isActive && !isCompletedDoc && (
                      <div
                        className={`absolute -top-11 bg-slate-900 text-white rounded-xl px-2.5 py-1 flex items-center gap-2 text-[10px] shadow-xl z-50 animate-in fade-in whitespace-nowrap border border-slate-700 ${
                          field.x < 50 ? "left-0" : "right-0"
                        }`}
                      >
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

                        {(field.type === "text" ||
                          field.type === "paragraph" ||
                          field.type === "checkbox" ||
                          field.type === "signature") && (
                          <>
                            <div className="h-3.5 w-[1px] bg-slate-700"></div>
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400 font-medium">Placeholder:</span>
                              <input
                                type="text"
                                value={field.placeholder || ""}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  setPlacedFields((prev) =>
                                    prev.map((f) => {
                                      if (f.id !== field.id) return f;
                                      // Editing the placeholder is how the recruiter previews
                                      // what candidates will see, so clear any stale value that
                                      // would otherwise hide it — but never wipe a real drawn
                                      // signature image.
                                      const keepValue = f.value?.startsWith("data:image");
                                      return { ...f, placeholder: next, value: keepValue ? f.value : "" };
                                    })
                                  );
                                }}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Custom placeholder..."
                                className="bg-slate-800 text-white placeholder-slate-500 rounded px-1.5 py-0.5 w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          </>
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
                          placeholder={
                            field.placeholder && field.placeholder !== "Text Field"
                              ? field.placeholder
                              : field.label && field.label !== "Text Field"
                                ? field.label
                                : "Type here"
                          }
                          className={`w-full h-full bg-transparent border-0 focus:outline-none focus:ring-0 text-slate-900 placeholder:text-indigo-800 placeholder:font-semibold ${
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
                          placeholder={
                            field.placeholder && field.placeholder !== "Text Field"
                              ? field.placeholder
                              : field.label && field.label !== "Text Field"
                                ? field.label
                                : "Type here"
                          }
                          className={`w-full h-full bg-transparent border-0 focus:outline-none focus:ring-0 resize-none text-slate-900 placeholder:text-indigo-800 placeholder:font-semibold ${
                            field.isBold ? "font-bold" : "font-normal"
                          } ${field.isItalic ? "italic" : ""}`}
                          style={{
                            fontSize: `${field.fontSize || 14}px`,
                            color: field.color || selectedColor,
                          }}
                        />
                      ) : field.type === "signature" ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFieldId(field.id);
                          }}
                          className="w-full h-full flex items-center justify-between px-2 cursor-pointer"
                        >
                          {field.value && field.value.startsWith("data:image") ? (
                            <img
                              src={field.value}
                              alt="Drawn Signature"
                              className="max-h-full max-w-full object-contain mx-auto pointer-events-none"
                            />
                          ) : (
                            <span className="font-serif italic text-blue-800 text-sm font-bold truncate">
                              {field.value || field.placeholder || "Sign Here ✍️"}
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
                            value={field.value || field.placeholder || "Checkbox option"}
                            onChange={(e) => handleUpdateFieldValue(field.id, e.target.value)}
                            onFocus={() => setActiveFieldId(field.id)}
                            className="bg-transparent border-0 focus:outline-none text-xs text-slate-800 font-semibold w-full"
                          />
                        </label>
                      ) : field.type === "radio" ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFieldId(field.id);
                          }}
                          className="w-full h-full flex flex-col justify-center gap-1 overflow-y-auto py-1"
                        >
                          {(field.options && field.options.length > 0 ? field.options : ["Option 1"]).map(
                            (option, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 group/option">
                                <span
                                  className="flex-shrink-0 rounded-full border-2 border-slate-400"
                                  style={{
                                    width: `${Math.max(12, field.fontSize || 14)}px`,
                                    height: `${Math.max(12, field.fontSize || 14)}px`,
                                  }}
                                ></span>
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => handleUpdateRadioOption(field.id, idx, e.target.value)}
                                  onFocus={() => setActiveFieldId(field.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="bg-transparent border-0 focus:outline-none text-slate-800 font-semibold flex-1 min-w-0"
                                  style={{ fontSize: `${field.fontSize || 14}px` }}
                                />
                                {(field.options?.length || 0) > 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveRadioOption(field.id, idx);
                                    }}
                                    className="opacity-0 group-hover/option:opacity-100 text-slate-400 hover:text-red-600 transition flex-shrink-0"
                                    title="Remove option"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddRadioOption(field.id);
                            }}
                            className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 transition"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Option</span>
                          </button>
                        </div>
                      ) : field.type === "dropdown" ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFieldId(field.id);
                          }}
                          className="w-full h-full flex items-center justify-between gap-1 px-1.5 cursor-pointer"
                        >
                          <span
                            className="truncate text-slate-700 font-semibold"
                            style={{ fontSize: `${field.fontSize || 14}px` }}
                          >
                            {field.value || (field.options && field.options[0]) || "Select an option"}
                          </span>
                          <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                        </div>
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
                          className="w-full h-full flex items-center justify-center p-1 cursor-move overflow-hidden select-none"
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

                    {/* Dropdown panel — rendered as a sibling of the Inline Content Box
                        (not nested inside it) because that box has overflow-hidden, which
                        would otherwise clip a panel meant to drop open below the field.
                        Opens like a real select menu, listing every option as editable so
                        the recruiter can define what candidates will get to choose from. */}
                    {field.type === "dropdown" && isActive && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-full left-0 mt-1 min-w-[180px] max-h-48 overflow-y-auto bg-white border border-slate-300 rounded-lg shadow-xl z-50 p-1.5 space-y-1"
                      >
                        {(field.options && field.options.length > 0 ? field.options : ["Option 1"]).map(
                          (option, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 group/option px-1.5 py-1 rounded hover:bg-slate-50"
                            >
                              <ChevronDownSquare className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => handleUpdateRadioOption(field.id, idx, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-transparent border-0 focus:outline-none text-slate-800 font-semibold text-xs flex-1 min-w-0"
                              />
                              {(field.options?.length || 0) > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveRadioOption(field.id, idx);
                                  }}
                                  className="opacity-0 group-hover/option:opacity-100 text-slate-400 hover:text-red-600 transition flex-shrink-0"
                                  title="Remove option"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddRadioOption(field.id);
                          }}
                          className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 transition px-1.5 py-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Option</span>
                        </button>
                      </div>
                    )}

                    {/* Right Edge Handle (Width Resize) — invisible so the fill box has no border */}
                    {isActive && !isCompletedDoc && (
                      <div
                        onMouseDown={(e) => handleResizeWidthMouseDown(field.id, e)}
                        className="resize-handle absolute top-0 bottom-0 -right-1 w-3 bg-transparent cursor-ew-resize z-40"
                        title="Drag right edge to change width"
                      />
                    )}

                    {/* Bottom Edge Handle (Height Resize) */}
                    {isActive && !isCompletedDoc && (
                      <div
                        onMouseDown={(e) => handleResizeHeightMouseDown(field.id, e)}
                        className="resize-handle absolute left-0 right-0 -bottom-1 h-3 bg-transparent cursor-ns-resize z-40"
                        title="Drag bottom edge to change height"
                      />
                    )}

                    {/* Bottom-Right Corner Handle (Both Width & Height Resize) */}
                    {isActive && !isCompletedDoc && (
                      <div
                        onMouseDown={(e) => handleResizeBothMouseDown(field.id, e)}
                        className="resize-handle absolute -bottom-1 -right-1 w-3 h-3 bg-indigo-400/80 hover:bg-indigo-500 rounded-sm cursor-nwse-resize z-50"
                        title="Drag corner to change both width & height"
                      />
                    )}
                  </div>
                );
              })}

            {/* Footer page number indicator */}
            <div className="absolute bottom-4 left-12 right-12 flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-100 pt-2">
              <span>CUS-DOC Secure Document Stream</span>
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
