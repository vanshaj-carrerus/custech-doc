import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { isMongoId } from "@/lib/mongoId";
import { DocumentRecord } from "@/models/Document";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      documentId,
      name,
      size,
      pages,
      senderEmail,
      fileType,
      placedFields,
    } = body;

    const cleanSender = String(senderEmail || "").trim().toLowerCase();
    if (!cleanSender) {
      return NextResponse.json(
        { success: false, message: "Sender email is required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    if (isMongoId(documentId)) {
      const existing = await DocumentRecord.findById(documentId).select(
        "-fileUrl -fileChunks"
      );
      if (existing) {
        return NextResponse.json({
          success: true,
          document: {
            id: existing._id.toString(),
            status: existing.status,
          },
        });
      }
    }

    const created = await DocumentRecord.create({
      name: name || "Document.pdf",
      size: size || "1.2 MB",
      pages: pages || 1,
      fileType: fileType || "application/pdf",
      senderEmail: cleanSender,
      placedFields: placedFields || [],
      status: "Draft",
    });

    return NextResponse.json({
      success: true,
      document: {
        id: created._id.toString(),
        status: created.status,
      },
    });
  } catch (error: unknown) {
    console.error("Draft create error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Could not prepare document",
      },
      { status: 500 }
    );
  }
}
