import { NextResponse } from "next/server";
import { recordEmailEvent, type EmailTrackEvent } from "@/lib/emailTrack";

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

const PIXEL_HEADERS = {
  "Content-Type": "image/gif",
  "Content-Length": String(TRANSPARENT_GIF.byteLength),
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

function pixelResponse() {
  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: PIXEL_HEADERS,
  });
}

function parseEvent(request: Request): EmailTrackEvent {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("event") || "open").toLowerCase();
  if (raw === "click" || raw === "view") return raw;
  return "open";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const event = parseEvent(request);
  const { searchParams } = new URL(request.url);

  await recordEmailEvent(id, event);

  if (event === "click") {
    const origin = new URL(request.url).origin;
    const candidate = searchParams.get("candidate") || "";
    const signingUrl = `${origin}/sign/${id}${
      candidate ? `?candidate=${encodeURIComponent(candidate)}` : ""
    }`;
    return NextResponse.redirect(signingUrl, 302);
  }

  if (event === "view") {
    return NextResponse.json({ success: true });
  }

  return pixelResponse();
}

export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await recordEmailEvent(id, parseEvent(request));
  return pixelResponse();
}
