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
  const lib = await import("pdfjs-dist");
  lib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
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
  const res = await fetch(dataUrlOrFile);
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

export function detectPdfPageCount(dataUrlOrFile: string | File): Promise<number> {
  return getPdfLayoutInfo(dataUrlOrFile).then((info) => info.pageCount);
}
