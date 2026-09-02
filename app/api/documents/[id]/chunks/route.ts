import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { isMongoId } from "@/lib/mongoId";
import { DocumentRecord } from "@/models/Document";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isMongoId(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid document id" },
      { status: 400 }
    );
  }

  try {
    const { index, total, data, mimeType } = await request.json();
    const chunkIndex = Number(index);
    const chunkTotal = Number(total);
    const chunkData = String(data || "");

    if (
      !Number.isInteger(chunkIndex) ||
      !Number.isInteger(chunkTotal) ||
      chunkTotal < 1 ||
      chunkIndex < 0 ||
      chunkIndex >= chunkTotal ||
      !chunkData
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid file chunk" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const doc = await DocumentRecord.findById(id);
    if (!doc) {
      return NextResponse.json(
        { success: false, message: "Document not found" },
        { status: 404 }
      );
    }

    const chunks = Array.isArray(doc.fileChunks) ? [...doc.fileChunks] : [];
    const withoutCurrent = chunks.filter((chunk) => chunk.index !== chunkIndex);
    withoutCurrent.push({ index: chunkIndex, data: chunkData });
    doc.fileChunks = withoutCurrent;

    const complete = withoutCurrent.length === chunkTotal;
    if (complete) {
      const assembled = withoutCurrent
        .sort((a, b) => a.index - b.index)
        .map((chunk) => chunk.data)
        .join("");
      const type = mimeType || doc.fileType || "application/pdf";
      doc.fileUrl = `data:${type};base64,${assembled}`;
      doc.fileType = type;
      doc.fileChunks = [];
      if (global.documentFileCache) {
        global.documentFileCache.delete(id);
      }
    }

    await doc.save();

    return NextResponse.json({
      success: true,
      received: withoutCurrent.length,
      total: chunkTotal,
      complete,
    });
  } catch (error: unknown) {
    console.error("Chunk upload error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Could not upload file chunk",
      },
      { status: 500 }
    );
  }
}
