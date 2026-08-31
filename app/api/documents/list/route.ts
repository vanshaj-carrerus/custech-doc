import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DocumentRecord } from "@/models/Document";

export async function GET(request: Request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.toLowerCase() || searchParams.get("senderEmail")?.toLowerCase();
    const docId = searchParams.get("id");

    let query: any = {};

    if (docId) {
      query._id = docId;
    } else if (email) {
      // Strictly filter documents by user email (sender or recipient)
      query = {
        $or: [
          { senderEmail: email },
          { recipientEmail: email },
        ],
      };
    } else {
      // Security isolation: If no user email or doc ID is provided, return empty array to prevent data leakage
      return NextResponse.json({
        success: true,
        count: 0,
        documents: [],
      });
    }

    const docs = await DocumentRecord.find(query).sort({ createdAt: -1 }).limit(50).lean();

    return NextResponse.json({
      success: true,
      count: docs.length,
      documents: docs.map((d) => ({
        id: d._id.toString(),
        title: d.name,
        senderEmail: d.senderEmail,
        recipientEmail: d.recipientEmail,
        recipientName: d.recipientName,
        updatedAt: d.createdAt ? d.createdAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }) : "Recently",
        pages: d.pages || 1,
        status: d.status || "Completed",
        size: d.size || "1.2 MB",
        fileUrl: d.fileUrl,
        fileType: d.fileType,
        placedFields: d.placedFields,
        filledFields: d.filledFields || d.placedFields,
        emailOpened: !!(d.emailOpened || d.emailOpenedAt || d.emailClickedAt || d.emailViewedAt),
        emailOpenedAt: d.emailOpenedAt ? new Date(d.emailOpenedAt).toISOString() : undefined,
        lastEmailOpenedAt: d.lastEmailOpenedAt ? new Date(d.lastEmailOpenedAt).toISOString() : undefined,
        emailClickedAt: d.emailClickedAt ? new Date(d.emailClickedAt).toISOString() : undefined,
      })),
    });
  } catch (error: any) {
    console.error("MongoDB Fetch Documents Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch from MongoDB" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("id");
    const requesterEmail = searchParams.get("requesterEmail")?.toLowerCase();

    if (!docId) {
      return NextResponse.json(
        { success: false, message: "Document id is required" },
        { status: 400 }
      );
    }

    const doc = await DocumentRecord.findById(docId);
    if (!doc) {
      return NextResponse.json(
        { success: false, message: "Document not found" },
        { status: 404 }
      );
    }

    const isOwner =
      requesterEmail &&
      (doc.senderEmail?.toLowerCase() === requesterEmail ||
        doc.recipientEmail?.toLowerCase() === requesterEmail);
    if (!isOwner) {
      return NextResponse.json(
        { success: false, message: "You don't have permission to delete this document" },
        { status: 403 }
      );
    }

    await DocumentRecord.findByIdAndDelete(docId);

    return NextResponse.json({ success: true, message: "Document deleted" });
  } catch (error: any) {
    console.error("MongoDB Delete Document Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete document" },
      { status: 500 }
    );
  }
}
