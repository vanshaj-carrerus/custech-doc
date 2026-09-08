/**
 * Utilities to detect the real page count and per-page render height of a
 * PDF file, Base64 data URL, blob URL, or remote URL, using pdfjs-dist
 * instead of guessing from raw PDF text (which fails on any PDF that uses
 * compressed object streams — i.e. most real-world PDFs).
 */

export const DEFAULT_PAGE_HEIGHT_PX = 1050;

export type PdfLayoutInfo = {
  pageCount: number;
  pageHeightPx: number;
};

let pdfjsLibPromise: ReturnType<typeof loadPdfjs> | null = null;

async function loadPdfjs() {
  const [lib, workerModule] = await Promise.all([
    import("pdfjs-dist"),
    // Imported (not spun up as a dedicated Worker) so parsing runs on the main
    // thread. Module Workers (`new Worker(url, { type: "module" })`) are what
    // pdf.js tries first, but they're unreliable on mobile browsers and in-app
    // webviews (Instagram/WhatsApp/etc.) — the worker can silently never
    // respond, leaving getDocument() hanging with nothing to catch or retry.
    // Plain dynamic import() of the same file works everywhere those don't.
    import("pdfjs-dist/build/pdf.worker.min.mjs"),
  ]);
  (globalThis as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = workerModule;
  return lib;
}

function getPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = loadPdfjs();
  }
  return pdfjsLibPromise;
}

export function isImageSource(dataUrlOrFile: string | File): boolean {
  if (dataUrlOrFile instanceof File) return dataUrlOrFile.type.startsWith("image/");
  return dataUrlOrFile.startsWith("data:image/");
}

export async function toUint8Array(dataUrlOrFile: string | File): Promise<Uint8Array> {
  if (dataUrlOrFile instanceof File) {
    return new Uint8Array(await dataUrlOrFile.arrayBuffer());
  }
  if (dataUrlOrFile.startsWith("data:")) {
    const base64Part = dataUrlOrFile.split(",")[1] || "";
    const binary = atob(base64Part);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  // Mobile connections stall mid-request far more often than the wifi/ethernet
  // desktop testing tends to happen over; fetch() has no default timeout, so
  // without this an interrupted mobile download hangs the signing page's PDF
  // loading spinner forever instead of ever reaching the retry UI.
  const res = await fetch(dataUrlOrFile, { signal: AbortSignal.timeout(20000) });
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Returns the real page count and the render height (in px, for a page
 * rendered at renderWidthPx wide) of the first page, derived from the
 * PDF's actual page geometry rather than an assumed A4 height.
 */
export async function getPdfLayoutInfo(
  dataUrlOrFile: string | File,
  renderWidthPx = 794
): Promise<PdfLayoutInfo> {
  if (typeof window === "undefined" || isImageSource(dataUrlOrFile)) {
    return { pageCount: 1, pageHeightPx: DEFAULT_PAGE_HEIGHT_PX };
  }
  try {
    const bytes = await toUint8Array(dataUrlOrFile);
    const pdfjsLib = await getPdfjs();
    const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const ratio = viewport.height / viewport.width;
    return {
      pageCount: doc.numPages || 1,
      pageHeightPx: Math.round(renderWidthPx * ratio) || DEFAULT_PAGE_HEIGHT_PX,
    };
  } catch {
    return { pageCount: 1, pageHeightPx: DEFAULT_PAGE_HEIGHT_PX };
  }
}

export async function getPdfjsLib() {
  return getPdfjs();
}

/**
 * Loads a PDF from raw bytes.
 */
export async function loadPdfDocument(bytes: Uint8Array) {
  const pdfjsLib = await getPdfjs();
  const pdf = await pdfjsLib.getDocument({
    data: bytes,
    disableStream: true,
    disableAutoFetch: true,
  }).promise;
  return { pdf, pdfjsLib };
}

export function canvasToObjectUrl(
  canvas: HTMLCanvasElement,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(canvas.toDataURL("image/jpeg", quality));
          return;
        }
        resolve(URL.createObjectURL(blob));
      },
      "image/jpeg",
      quality
    );
  });
}

export function revokePageObjectUrls(urls: string[]) {
  for (const url of urls) {
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  }
}

/**
 * One word/run of text on a rendered PDF page, positioned both in on-screen
 * pixels (for the editable overlay) and in raw PDF point-space (for baking
 * an edit into an exported/downloaded PDF with pdf-lib, whose coordinate
 * system already matches pdf.js's unscaled item.transform).
 */
export interface PdfTextItem {
  id: string; // `${pageIndex}-${itemIndexOnPage}` — stable for a given file, used as the textEdits key
  pageIndex: number;
  original: string;
  leftPx: number;
  topPx: number; // relative to the top of the whole stacked-pages canvas
  widthPx: number;
  fontSizePx: number;
  angleDeg: number;
  fontFamily: string;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfFontSize: number;
}

/**
 * Extracts every text run on one already-rendered PDF page, positioned to
 * line up pixel-for-pixel with a canvas rendered using the same `viewport`.
 * Mirrors the affine-transform math pdf.js's own TextLayer uses internally
 * (see pdfjs-dist/build/pdf.mjs, TextLayer#appendText) so the overlay lines
 * up without depending on their CSS-variable-driven text layer machinery.
 */
interface PdfPageLike {
  getTextContent: () => Promise<{
    items: unknown[];
    styles: Record<string, { fontFamily?: string; vertical?: boolean }>;
  }>;
}

interface PdfViewportLike {
  transform: number[];
}

export async function extractPageTextItems(
  page: PdfPageLike,
  viewport: PdfViewportLike,
  pdfjsUtil: { transform: (m1: number[], m2: number[]) => number[] },
  pageIndex: number,
  pageTopOffsetPx: number
): Promise<PdfTextItem[]> {
  const textContent = await page.getTextContent();
  const scale = Math.hypot(viewport.transform[0], viewport.transform[1]);
  const items: PdfTextItem[] = [];
  let index = 0;

  for (const rawItem of textContent.items) {
    const raw = rawItem as { str?: string; fontName?: string; transform?: number[]; width?: number };
    if (typeof raw.str !== "string" || !raw.str.trim() || !raw.transform) continue;

    const style = textContent.styles?.[raw.fontName || ""];
    const tx = pdfjsUtil.transform(viewport.transform, raw.transform);
    const angle = Math.atan2(tx[1], tx[0]);
    const fontHeightPx = Math.hypot(tx[2], tx[3]);
    const ascentPx = fontHeightPx * 0.8;

    const leftPx = angle === 0 ? tx[4] : tx[4] + ascentPx * Math.sin(angle);
    const topPx = angle === 0 ? tx[5] - ascentPx : tx[5] - ascentPx * Math.cos(angle);
    const fontHeightRaw = Math.hypot(raw.transform[2], raw.transform[3]);

    items.push({
      id: `${pageIndex}-${index}`,
      pageIndex,
      original: raw.str,
      leftPx,
      topPx: topPx + pageTopOffsetPx,
      widthPx: (raw.width || 0) * scale,
      fontSizePx: fontHeightPx,
      angleDeg: angle * (180 / Math.PI),
      fontFamily: style?.fontFamily || "sans-serif",
      pdfX: raw.transform[4],
      pdfY: raw.transform[5],
      pdfWidth: raw.width || 0,
      pdfFontSize: fontHeightRaw,
    });
    index++;
  }

  return items;
}

export function detectPdfPageCount(dataUrlOrFile: string | File): Promise<number> {
  return getPdfLayoutInfo(dataUrlOrFile).then((info) => info.pageCount);
}

interface FieldLike {
  id: string;
  type: string;
  label?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  value?: string;
}

/**
 * Builds a real, flattened PDF (as bytes) from the source document with every
 * field's current value (text, checkbox, signature image) drawn onto the
 * matching page, at the position/size it has in the on-screen editor/signing
 * view — plus any baked-in overrides of the PDF's own text. Shared by the
 * recruiter's editor export and the candidate's signed-document download so
 * both produce an identical rendering of "what the field overlay shows".
 */
export async function buildFilledPdfBytes({
  fileUrl,
  isImageDoc,
  pageCount,
  pageHeightPx,
  fields,
  textEdits,
  textOverlayItems,
}: {
  fileUrl: string;
  isImageDoc: boolean;
  pageCount: number;
  pageHeightPx: number;
  fields: FieldLike[];
  textEdits: Record<string, string>;
  textOverlayItems: PdfTextItem[];
}): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  let pdfDoc;
  if (isImageDoc) {
    const imgBytes = await (await fetch(fileUrl)).arrayBuffer();
    pdfDoc = await PDFDocument.create();
    const img = fileUrl.includes("image/png")
      ? await pdfDoc.embedPng(imgBytes)
      : await pdfDoc.embedJpg(imgBytes);
    const page = pdfDoc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  } else {
    const pdfBytes = await (await fetch(fileUrl)).arrayBuffer();
    pdfDoc = await PDFDocument.load(pdfBytes);
  }

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  const renderWidthPx = 794;
  const totalHeightPx = pageCount * pageHeightPx;

  // Standard PDF fonts only support WinAnsi (Latin-1) characters — strip anything
  // outside that range (emoji, etc.) so one odd character can't break the export.
  const toWinAnsiSafe = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

  // Bake in-place edits to the PDF's own text: white out the original run
  // (using its position straight from pdf.js's text content, which is
  // already in the same point-space pdf-lib's pages use) and draw the
  // replacement over it.
  if (!isImageDoc && Object.keys(textEdits).length > 0) {
    const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    for (const [id, newText] of Object.entries(textEdits)) {
      const item = textOverlayItems.find((t) => t.id === id);
      const pdfPage = item ? pages[item.pageIndex] : undefined;
      if (!item || !pdfPage) continue;
      try {
        const coverWidth =
          Math.max(
            item.pdfWidth,
            item.pdfWidth * (newText.length / (item.original.length || 1)),
            4
          ) + 2;
        pdfPage.drawRectangle({
          x: item.pdfX - 1,
          y: item.pdfY - item.pdfFontSize * 0.3,
          width: coverWidth,
          height: item.pdfFontSize * 1.3,
          color: rgb(1, 1, 1),
        });
        const safeText = toWinAnsiSafe(newText);
        if (safeText.trim()) {
          pdfPage.drawText(safeText, {
            x: item.pdfX,
            y: item.pdfY,
            size: item.pdfFontSize,
            font: bodyFont,
            color: rgb(0.05, 0.05, 0.05),
          });
        }
      } catch (textEditErr) {
        console.warn(`Skipping text edit "${id}" in PDF export:`, textEditErr);
      }
    }
  }

  for (const field of fields) {
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

  return pdfDoc.save();
}

/** Triggers a browser download of a PDF built by {@link buildFilledPdfBytes}. */
export function downloadPdfBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/\.pdf$/i, "") + ".pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
