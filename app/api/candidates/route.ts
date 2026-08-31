import { NextResponse } from "next/server";
import { GOOGLE_WEBAPP_URL, normalizeSheetRows } from "@/lib/googleWebApp";

export async function GET() {
  try {
    const res = await fetch(GOOGLE_WEBAPP_URL, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: "Could not load candidates from the sheet" },
        { status: 502 }
      );
    }
    const rows = await res.json();
    const candidates = normalizeSheetRows(rows);
    return NextResponse.json({ success: true, candidates, source: GOOGLE_WEBAPP_URL });
  } catch (error: any) {
    console.warn("[Candidates] Google web app fetch failed:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch candidates" },
      { status: 500 }
    );
  }
}
