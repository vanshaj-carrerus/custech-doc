import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DocumentRecord } from "@/models/Document";

const MONGO_ID_RE = /^[a-fA-F0-9]{24}$/;

export async function GET(request: Request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.toLowerCase() || searchParams.get("senderEmail")?.toLowerCase();
    const docId = searchParams.get("id");

    let query: any = {};

    if (docId) {
      if (!MONGO_ID_RE.test(docId)) {
        return NextResponse.json(
          {
            success: false,
            message:
              "This signing link is invalid. The document must be sent again so the candidate gets a valid link.",
          },
          { status: 404 }
        );
      }
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

    const documentsQuery = DocumentRecord.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .select("-fileUrl");
    if (!docId) {
      // Dashboard rows only need metadata. Returning every Base64 PDF here can
      // create a response hundreds of megabytes large and make old data appear
      // to be missing while the browser waits for it.
      documentsQuery.select("-placedFields -filledFields");
    }
    const docs = await documentsQuery.lean();

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
        fileUrl: docId ? `/api/documents/${d._id.toString()}/file` : undefined,
        fileType: d.fileType,
        placedFields: d.placedFields,
        filledFields: d.filledFields || d.placedFields,
        emailOpened: !!(d.emailOpened || d.emailOpenedAt || d.emailClickedAt || d.emailViewedAt),
        emailOpenedAt: d.emailOpenedAt ? new Date(d.emailOpenedAt).toISOString() : undefined,
        lastEmailOpenedAt: d.lastEmailOpenedAt ? new Date(d.lastEmailOpenedAt).toISOString() : undefined,
        emailClickedAt: d.emailClickedAt ? new Date(d.emailClickedAt).toISOString() : undefined,
        reminderCount: d.reminderCount || 0,
        lastReminderAt: d.lastReminderAt ? new Date(d.lastReminderAt).toISOString() : undefined,
        automaticReminderSentAt: d.automaticReminderSentAt
          ? new Date(d.automaticReminderSentAt).toISOString()
          : undefined,
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

    if (!docId || !MONGO_ID_RE.test(docId) || !requesterEmail) {
      return NextResponse.json(
        { success: false, message: "Valid document id and requester email are required" },
        { status: 400 }
      );
    }

    const result = await DocumentRecord.deleteOne({
      _id: docId,
      $or: [
        { senderEmail: requesterEmail },
        { recipientEmail: requesterEmail },
      ],
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: "Document not found or you don't have permission" },
        { status: 404 }
      );
    }

    global.documentFileCache?.delete(docId);

    return NextResponse.json({ success: true, message: "Document deleted" });
  } catch (error: any) {
    console.error("MongoDB Delete Document Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete document" },
      { status: 500 }
    );
  }
}
