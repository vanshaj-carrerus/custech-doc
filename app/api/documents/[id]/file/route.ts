import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DocumentRecord } from "@/models/Document";

const MONGO_ID_RE = /^[a-fA-F0-9]{24}$/;

type CachedDocumentFile = {
  bytes: Buffer;
  contentType: string;
  name: string;
};

declare global {
  var documentFileCache: Map<string, CachedDocumentFile> | undefined;
}

const documentFileCache =
  global.documentFileCache || new Map<string, CachedDocumentFile>();
if (!global.documentFileCache) {
  global.documentFileCache = documentFileCache;
}

function fileResponse(file: CachedDocumentFile) {
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.bytes.length),
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!MONGO_ID_RE.test(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid document id" },
      { status: 400 }
    );
  }

  try {
    const cachedFile = documentFileCache.get(id);
    if (cachedFile) return fileResponse(cachedFile);

    await connectToDatabase();
    const doc = await DocumentRecord.findById(id)
      .select("fileUrl fileType name")
      .lean();
    const fileUrl = doc?.fileUrl;

    if (!doc || !fileUrl) {
      return NextResponse.json(
        { success: false, message: "Document file not found" },
        { status: 404 }
      );
    }

    if (/^https?:\/\//i.test(fileUrl)) {
      // Proxy the remote file (ImageKit, etc.) instead of redirecting.
      // A 302 to a raw PDF makes mobile Chrome show its "Open" download
      // screen inside an iframe / after fetch, instead of the document pages.
      // Timeout so a stalled upstream fetch fails fast with a retryable error
      // instead of holding the serverless invocation open until the platform
      // kills it — the candidate's browser would otherwise see nothing but a
      // spinner that never resolves.
      let upstream: Response;
      try {
        upstream = await fetch(fileUrl, { cache: "force-cache", signal: AbortSignal.timeout(20000) });
      } catch {
        return NextResponse.json(
          { success: false, message: "Could not load the stored document file" },
          { status: 502 }
        );
      }
      if (!upstream.ok || !upstream.body) {
        return NextResponse.json(
          { success: false, message: "Could not load the stored document file" },
          { status: 502 }
        );
      }
      const contentType =
        doc.fileType ||
        upstream.headers.get("content-type") ||
        "application/pdf";
      return new Response(upstream.body, {
        headers: {
          "Content-Type": contentType.includes("pdf")
            ? "application/pdf"
            : contentType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(doc.name || "document.pdf")}"`,
          "Cache-Control": "private, max-age=86400",
        },
      });
    }

    const dataUrl = fileUrl.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
    if (!dataUrl) {
      return NextResponse.json(
        { success: false, message: "Unsupported document storage format" },
        { status: 415 }
      );
    }

    const contentType = dataUrl[1] || doc.fileType || "application/pdf";
    const bytes = dataUrl[2]
      ? Buffer.from(dataUrl[3], "base64")
      : Buffer.from(decodeURIComponent(dataUrl[3]), "utf8");
    const cachedDocument = {
      bytes,
      contentType,
      name: doc.name || "document.pdf",
    };
    documentFileCache.set(id, cachedDocument);
    if (documentFileCache.size > 10) {
      const oldestId = documentFileCache.keys().next().value;
      if (oldestId) documentFileCache.delete(oldestId);
    }

    return fileResponse(cachedDocument);
  } catch (error: unknown) {
    console.error("Document file fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Could not load document file",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!MONGO_ID_RE.test(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid document id" },
      { status: 400 }
    );
  }

  try {
    const { fileUrl, fileType } = await request.json();
    if (!fileUrl || !/^https?:\/\//i.test(fileUrl)) {
      return NextResponse.json(
        { success: false, message: "A valid uploaded file URL is required" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    await DocumentRecord.updateOne(
      { _id: id },
      { $set: { fileUrl, fileType: fileType || "application/pdf" } }
    );
    documentFileCache.delete(id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Document file save error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Could not save the uploaded file",
      },
      { status: 500 }
    );
  }
}
