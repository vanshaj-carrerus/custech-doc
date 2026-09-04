import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { isMongoId } from "@/lib/mongoId";
import { DocumentRecord } from "@/models/Document";

// Using a template never edits the template itself — it stamps out a brand
// new document (fresh _id, blank status/candidate) copied from the
// template's file and field layout, so the same template can be reused for
// many different candidates without them ever colliding on one record.
export async function POST(request: Request) {
  try {
    const { templateId, senderEmail } = await request.json();
    const cleanSender = String(senderEmail || "").trim().toLowerCase();

    if (!isMongoId(templateId) || !cleanSender) {
      return NextResponse.json(
        { success: false, message: "A valid template id and sender email are required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const template = await DocumentRecord.findOne({
      _id: templateId,
      isTemplate: true,
      senderEmail: cleanSender,
    }).lean();

    if (!template) {
      return NextResponse.json(
        { success: false, message: "Template not found" },
        { status: 404 }
      );
    }

    const created = await DocumentRecord.create({
      name: template.name,
      size: template.size,
      pages: template.pages,
      fileUrl: template.fileUrl,
      fileType: template.fileType,
      senderEmail: cleanSender,
      placedFields: template.placedFields || [],
      status: "Draft",
      isTemplate: false,
    });

    return NextResponse.json({
      success: true,
      document: {
        id: created._id.toString(),
        name: created.name,
        size: created.size,
        pages: created.pages,
        fileUrl: created.fileUrl ? `/api/documents/${created._id.toString()}/file` : undefined,
        fileType: created.fileType,
        placedFields: created.placedFields,
        status: created.status,
      },
    });
  } catch (error: unknown) {
    console.error("Template use error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Could not create a document from this template",
      },
      { status: 500 }
    );
  }
}
