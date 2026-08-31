export const GOOGLE_WEBAPP_URL =
  process.env.GOOGLE_WEBAPP_URL ||
  "https://script.google.com/macros/s/AKfycbzJDyamlIUPTAtV2Tu2YEJIN32Ex7xx2N1xEcJbazGXjkCJ8w8gXAeE81J2wQYYs38u/exec";

export type SheetCandidate = {
  employeeName: string;
  candidateName: string;
  type: string;
  amount: number;
  month: string;
};

function isRealCandidateName(name: string) {
  const n = name.trim();
  if (n.length < 3) return false;
  if (/^total\b/i.test(n)) return false;
  if (/^\d+(\.\d+)?$/.test(n)) return false;
  return /[a-zA-Z]/.test(n);
}

export function normalizeSheetRows(rows: any[]): SheetCandidate[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const out: SheetCandidate[] = [];
  for (const row of rows) {
    const candidateName = String(row["Candidate Name"] || row.candidateName || "").trim();
    if (!isRealCandidateName(candidateName)) continue;
    const key = candidateName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      employeeName: String(row["Employee Name"] || row.employeeName || "").trim(),
      candidateName,
      type: String(row.Type || row.type || ""),
      amount: Number(row.Amount ?? row.amount ?? 0),
      month: String(row.Month || row.month || ""),
    });
  }
  return out.sort((a, b) => a.candidateName.localeCompare(b.candidateName));
}
