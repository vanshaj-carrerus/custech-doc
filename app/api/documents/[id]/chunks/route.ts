import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { isMongoId } from "@/lib/mongoId";
import { FileChunk } from "@/models/FileChunk";
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
    const { index, data } = await request.json();
    const chunkIndex = Number(index);
    const chunkData = String(data || "");

    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || !chunkData) {
      return NextResponse.json(
        { success: false, message: "Invalid file chunk" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    await FileChunk.updateOne(
      { docId: id, index: chunkIndex },
      { $set: { docId: id, index: chunkIndex, data: chunkData } },
      { upsert: true }
    );

    return NextResponse.json({ success: true, index: chunkIndex });
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

export async function PUT(
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
    const { total, mimeType } = await request.json();
    await connectToDatabase();

    const alreadyHasFile = await DocumentRecord.exists({
      _id: id,
      fileUrl: { $exists: true, $nin: [null, ""] },
    });
    if (alreadyHasFile) {
      await FileChunk.deleteMany({ docId: id });
      return NextResponse.json({ success: true, complete: true });
    }

    const chunks = await FileChunk.find({ docId: id }).sort({ index: 1 }).lean();
    if (typeof total === "number" && chunks.length < total) {
      return NextResponse.json(
        { success: false, message: "File upload is incomplete. Please send again." },
        { status: 409 }
      );
    }

    const assembled = chunks.map((chunk) => chunk.data).join("");
    const type = mimeType || "application/pdf";
    await DocumentRecord.updateOne(
      { _id: id },
      {
        $set: {
          fileUrl: `data:${type};base64,${assembled}`,
          fileType: type,
        },
        $unset: { fileChunks: 1 },
      }
    );
    await FileChunk.deleteMany({ docId: id });
    global.documentFileCache?.delete(id);

    return NextResponse.json({ success: true, complete: true });
  } catch (error: unknown) {
    console.error("Assemble file error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Could not finish file upload",
      },
      { status: 500 }
    );
  }
}
