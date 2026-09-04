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
