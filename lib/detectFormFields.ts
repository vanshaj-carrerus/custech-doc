import { DocumentField } from "@/types/dochub";
import {
  DEFAULT_PAGE_HEIGHT_PX,
  getPdfjsLib,
  isImageSource,
  toUint8Array,
} from "@/lib/pdfUtils";

const RENDER_WIDTH = 794;
const MAX_PAGES = 8;
const MAX_FIELDS = 36;

type RawBlank = {
  xPx: number;
  yPx: number;
  width: number;
  height: number;
  label: string;
  type: DocumentField["type"];
  source: "annotation" | "underscore" | "line" | "shade";
};

function guessType(label: string, height: number, width: number): DocumentField["type"] {
  const t = label.toLowerCase();
  if (/sign/.test(t) && !/assign|design/.test(t)) return "signature";
  if (/initial/.test(t)) return "initials";
  if (/\bdate\b|dob|birth|signed on/.test(t)) return "date";
  if (/check|agree|accept|confirm|opt[- ]?in/.test(t)) return "checkbox";
  if (/note|comment|descrip|message|address|explain/.test(t) || (height > 48 && width > 280)) {
    return "paragraph";
  }
  return "text";
}

function cleanLabel(raw: string) {
  const trimmed = raw.replace(/[:._\-–—]+$/g, "").replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.length > 42) return "Text Field";
  return trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
}

function overlaps(a: RawBlank, b: RawBlank) {
  const ax2 = a.xPx + a.width;
  const ay2 = a.yPx + a.height;
  const bx2 = b.xPx + b.width;
  const by2 = b.yPx + b.height;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.xPx, b.xPx));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.yPx, b.yPx));
  const inter = ix * iy;
  if (inter <= 0) return false;
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return inter / smaller > 0.4;
}

function mergeBlanks(list: RawBlank[]) {
  const rank = { shade: 4, annotation: 3, underscore: 2, line: 1 };
  const sorted = [...list].sort((a, b) => rank[b.source] - rank[a.source] || a.yPx - b.yPx);
  const kept: RawBlank[] = [];
  for (const item of sorted) {
    if (kept.some((k) => overlaps(k, item))) continue;
    kept.push(item);
  }
  return kept.sort((a, b) => a.yPx - b.yPx || a.xPx - b.xPx).slice(0, MAX_FIELDS);
}

function toDocumentFields(blanks: RawBlank[], totalHeightPx: number): DocumentField[] {
  return mergeBlanks(blanks).map((b, i) => {
    const type = guessType(b.label, b.height, b.width);
    const height =
      type === "signature"
        ? Math.max(42, b.height)
        : type === "paragraph"
          ? Math.max(64, b.height)
          : Math.max(22, Math.min(48, b.height));
    const width = Math.max(type === "checkbox" ? 28 : 80, Math.min(520, b.width));
    return {
      id: `auto-${Date.now()}-${i}`,
      type,
      label:
        type === "signature" ? "Signature" : type === "date" ? "Date Signed" : cleanLabel(b.label),
      x: Math.max(0, Math.min(92, (b.xPx / RENDER_WIDTH) * 100)),
      y: Math.max(0, Math.min(96, (b.yPx / totalHeightPx) * 100)),
      width,
      height,
      fontSize: 14,
      value: "",
      placeholder: type === "text" ? cleanLabel(b.label) : undefined,
      isLocked: type === "signature" || type === "initials",
    } satisfies DocumentField;
  });
}

function nearestLabel(
  texts: { str: string; x: number; y: number; w: number; h: number }[],
  x: number,
  y: number
) {
  let best = "";
  let bestScore = Infinity;
  for (const t of texts) {
    const sameLine = Math.abs(t.y - y) < Math.max(22, t.h * 2);
    const leftOf = t.x + t.w <= x + 12;
    if (!sameLine || !leftOf) continue;
    const gap = x - (t.x + t.w);
    if (gap > 460) continue;
    const score = gap + Math.abs(t.y - y);
    if (score < bestScore && t.str.trim().length > 1) {
      bestScore = score;
      best = t.str;
    }
  }
  return best;
}

function detectLinesOnCanvas(
  canvas: HTMLCanvasElement,
  pageTopPx: number,
  texts: { str: string; x: number; y: number; w: number; h: number }[]
): RawBlank[] {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  const { width, height } = canvas;
  if (width < 40 || height < 40) return [];

  const img = ctx.getImageData(0, 0, width, height).data;
  const darkAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const i = (y * width + x) * 4;
    const g = (img[i] + img[i + 1] + img[i + 2]) / 3;
    return g < 150 && img[i + 3] > 80;
  };

  const minLen = Math.max(56, Math.floor(width * 0.1));
  const rawSegs: { x: number; y: number; w: number }[] = [];

  for (let y = 10; y < height - 10; y += 1) {
    let start = -1;
    let len = 0;
    for (let x = 8; x < width - 8; x++) {
      if (darkAt(x, y)) {
        if (start < 0) start = x;
        len++;
      } else {
        if (len >= minLen) rawSegs.push({ x: start, y, w: len });
        start = -1;
        len = 0;
      }
    }
    if (len >= minLen && start >= 0) rawSegs.push({ x: start, y, w: len });
  }

  const clustered: { x: number; y: number; w: number }[] = [];
  const used = new Set<number>();
  for (let i = 0; i < rawSegs.length; i++) {
    if (used.has(i)) continue;
    const group = [rawSegs[i]];
    used.add(i);
    for (let j = i + 1; j < rawSegs.length; j++) {
      if (used.has(j)) continue;
      const a = group[group.length - 1];
      const b = rawSegs[j];
      if (Math.abs(b.y - a.y) <= 2 && Math.abs(b.x - a.x) < 24 && Math.abs(b.w - a.w) < 40) {
        group.push(b);
        used.add(j);
      }
    }
    const y = group[Math.floor(group.length / 2)].y;
    const x = Math.min(...group.map((g) => g.x));
    const w = Math.max(...group.map((g) => g.x + g.w)) - x;
    if (group.length > 5) continue;

    let ink = 0;
    let samples = 0;
    for (let dy = 3; dy <= 16; dy++) {
      for (let dx = 0; dx < w; dx += 5) {
        samples++;
        if (darkAt(x + dx, y - dy)) ink++;
      }
    }
    if (samples && ink / samples > 0.14) continue;

    clustered.push({ x, y, w });
  }

  return clustered.map((s) => {
    const fieldH = 32;
    const yPx = pageTopPx + Math.max(0, s.y - fieldH + 2);
    const label = nearestLabel(texts, s.x, s.y) || "Text Field";
    return {
      xPx: s.x,
      yPx,
      width: s.w,
      height: fieldH,
      label,
      type: guessType(label, fieldH, s.w),
      source: "line" as const,
    };
  });
}

function detectShadedBoxes(
  canvas: HTMLCanvasElement,
  pageTopPx: number,
  texts: { str: string; x: number; y: number; w: number; h: number }[]
): RawBlank[] {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  const { width, height } = canvas;
  if (width < 40 || height < 40) return [];

  const img = ctx.getImageData(0, 0, width, height).data;
  const isPaleBlue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const i = (y * width + x) * 4;
    const r = img[i];
    const g = img[i + 1];
    const b = img[i + 2];
    const a = img[i + 3];
    if (a < 80) return false;
    const avg = (r + g + b) / 3;
    if (avg < 188 || avg > 248) return false;
    if (g > b + 6) return false;
    return b > r + 3 && b >= g;
  };

  const minW = 64;
  const runs: { x: number; y: number; w: number }[] = [];
  for (let y = 6; y < height - 6; y++) {
    let start = -1;
    let len = 0;
    for (let x = 6; x < width - 6; x++) {
      if (isPaleBlue(x, y)) {
        if (start < 0) start = x;
        len++;
      } else {
        if (len >= minW) runs.push({ x: start, y, w: len });
        start = -1;
        len = 0;
      }
    }
    if (len >= minW && start >= 0) runs.push({ x: start, y, w: len });
  }

  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  const used = new Set<number>();
  for (let i = 0; i < runs.length; i++) {
    if (used.has(i)) continue;
    let minX = runs[i].x;
    let maxX = runs[i].x + runs[i].w;
    let minY = runs[i].y;
    let maxY = runs[i].y;
    used.add(i);
    for (let j = i + 1; j < runs.length; j++) {
      if (used.has(j)) continue;
      const r = runs[j];
      if (r.y > maxY + 2) break;
      const overlap = Math.min(maxX, r.x + r.w) - Math.max(minX, r.x);
      if (overlap > Math.min(maxX - minX, r.w) * 0.55 && r.y <= maxY + 2) {
        used.add(j);
        minX = Math.min(minX, r.x);
        maxX = Math.max(maxX, r.x + r.w);
        maxY = r.y;
      }
    }
    const w = maxX - minX;
    const h = maxY - minY + 1;
    if (h < 16 || h > 72 || w < 70 || w > width * 0.92) continue;
    boxes.push({ x: minX, y: minY, w, h });
  }

  return boxes.map((box) => {
    const label = nearestLabel(texts, box.x, box.y + box.h / 2) || "Text Field";
    return {
      xPx: box.x,
      yPx: pageTopPx + box.y,
      width: box.w,
      height: box.h,
      label,
      type: guessType(label, box.h, box.w),
      source: "shade" as const,
    };
  });
}

function detectUnderscores(
  texts: { str: string; x: number; y: number; w: number; h: number }[],
  pageTopPx: number
): RawBlank[] {
  const blanks: RawBlank[] = [];
  const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);
  const runs: typeof texts = [];
  let current: (typeof texts)[0] | null = null;

  for (const t of sorted) {
    const isBlankish = /^[_\.\-–—\s]{2,}$/.test(t.str) || /_{3,}|\.{4,}|_{2,}/.test(t.str);
    if (!isBlankish) {
      current = null;
      continue;
    }
    if (current && Math.abs(t.y - current.y) < 8 && t.x <= current.x + current.w + 14) {
      current.w = t.x + t.w - current.x;
      current.str += t.str;
    } else {
      current = { ...t };
      runs.push(current);
    }
  }

  for (const run of runs) {
    if (run.w < 36 && run.str.replace(/\s/g, "").length < 4) continue;
    const label = nearestLabel(texts, run.x, run.y) || "Text Field";
    blanks.push({
      xPx: run.x,
      yPx: pageTopPx + Math.max(0, run.y - 4),
      width: Math.max(80, run.w),
      height: Math.max(28, run.h + 10),
      label,
      type: guessType(label, 32, run.w),
      source: "underscore",
    });
  }

  for (const t of texts) {
    if (!/[:]\s*$/.test(t.str) || t.str.trim().length < 3) continue;
    const gapStart = t.x + t.w + 6;
    const sameLine = texts.filter((o) => o !== t && Math.abs(o.y - t.y) < 12 && o.x > t.x);
    const next = sameLine.sort((a, b) => a.x - b.x)[0];
    const gapEnd = next ? next.x - 8 : RENDER_WIDTH - 36;
    const gap = gapEnd - gapStart;
    if (gap < 70) continue;
    blanks.push({
      xPx: gapStart,
      yPx: pageTopPx + Math.max(0, t.y - 6),
      width: Math.min(420, gap),
      height: 32,
      label: t.str,
      type: guessType(t.str, 32, gap),
      source: "underscore",
    });
  }

  return blanks;
}

async function detectPdfBlanks(source: string | File): Promise<DocumentField[]> {
  const pdfjsLib = await getPdfjsLib();
  const bytes = await toUint8Array(source);
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pageCount = Math.min(doc.numPages || 1, MAX_PAGES);
  const first = await doc.getPage(1);
  const baseVp = first.getViewport({ scale: 1 });
  const scale = RENDER_WIDTH / baseVp.width;
  const pageHeightPx = Math.round(baseVp.height * scale) || DEFAULT_PAGE_HEIGHT_PX;
  const totalHeightPx = pageHeightPx * Math.max(doc.numPages || 1, 1);

  const collected: RawBlank[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const pageTopPx = (i - 1) * pageHeightPx;

    try {
      const annotations = await page.getAnnotations();
      for (const a of annotations as any[]) {
        const subtype = String(a.subtype || "");
        const fieldType = String(a.fieldType || "");
        if (!/Widget/i.test(subtype) && !fieldType) continue;
        const rect = a.rect as number[] | undefined;
        if (!rect || rect.length < 4) continue;
        const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(rect);
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const w = Math.abs(x2 - x1);
        const h = Math.abs(y2 - y1);
        if (w < 12 || h < 8) continue;
        let type: DocumentField["type"] = "text";
        if (a.checkBox || fieldType === "Btn") type = "checkbox";
        if (a.radioButton) type = "radio";
        if (fieldType === "Sig" || /sig/i.test(a.fieldName || "")) type = "signature";
        if (fieldType === "Ch") type = "dropdown";
        const label = a.fieldName || a.alternativeText || a.buttonValue || "Text Field";
        collected.push({
          xPx: left,
          yPx: pageTopPx + top,
          width: w,
          height: h,
          label: String(label),
          type,
          source: "annotation",
        });
      }
    } catch {
      // Some PDFs have unreadable annotation dicts.
    }

    let texts: { str: string; x: number; y: number; w: number; h: number }[] = [];
    try {
      const content = await page.getTextContent();
      for (const item of content.items as any[]) {
        if (!item || typeof item.str !== "string") continue;
        const tr = item.transform as number[] | undefined;
        if (!tr) continue;
        const pt = viewport.convertToViewportPoint(tr[4], tr[5]);
        const fontH = Math.abs(tr[3]) * scale || 12;
        const widthPdf =
          typeof item.width === "number" ? item.width * scale : item.str.length * fontH * 0.5;
        texts.push({
          str: item.str,
          x: pt[0],
          y: pt[1] - fontH,
          w: Math.max(4, widthPdf),
          h: Math.max(8, fontH),
        });
      }
      collected.push(...detectUnderscores(texts, pageTopPx));
    } catch {
      texts = [];
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        } as any);
        await renderTask.promise;
        collected.push(...detectLinesOnCanvas(canvas, pageTopPx, texts));
        collected.push(...detectShadedBoxes(canvas, pageTopPx, texts));
      }
    } catch {
      // Canvas render is best-effort.
    }
  }

  return toDocumentFields(collected, totalHeightPx);
}

async function detectImageBlanks(source: string | File): Promise<DocumentField[]> {
  const dataUrl =
    typeof source === "string"
      ? source
      : await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(source);
        });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not read image"));
    el.src = dataUrl;
  });

  const scale = RENDER_WIDTH / Math.max(1, img.width);
  const width = RENDER_WIDTH;
  const height = Math.max(200, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, width, height);
  const lines = detectLinesOnCanvas(canvas, 0, []);
  const shades = detectShadedBoxes(canvas, 0, []);
  return toDocumentFields([...shades, ...lines], height);
}

export async function detectBlankFormFields(source: string | File): Promise<DocumentField[]> {
  if (typeof window === "undefined") return [];
  try {
    if (isImageSource(source) || (typeof source === "string" && source.startsWith("data:image/"))) {
      return await detectImageBlanks(source);
    }
    return await detectPdfBlanks(source);
  } catch (error) {
    console.warn("[Auto-detect fields]", error);
    return [];
  }
}

export type FillProfile = {
  name?: string;
  email?: string;
};

export function autoFillFromProfile(
  fields: DocumentField[],
  profile: FillProfile,
  options?: { overwriteName?: boolean }
): DocumentField[] {
  const today = new Date().toISOString().split("T")[0];
  return fields.map((f) => {
    const key = `${f.label} ${f.placeholder || ""}`.toLowerCase();
    const hasValue = !!(f.value && String(f.value).trim());

    if (/e-?mail/.test(key) && profile.email && (!hasValue || options?.overwriteName)) {
      return { ...f, value: profile.email };
    }
    if (/(full\s*)?name/.test(key) && !/file name|filename/.test(key) && profile.name) {
      if (!hasValue || options?.overwriteName) {
        return { ...f, value: profile.name };
      }
    }
    if (!hasValue && (/\bdate\b/.test(key) || f.type === "date")) {
      return { ...f, type: "date", value: today };
    }
    return f;
  });
}

