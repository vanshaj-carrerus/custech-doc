import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { sendCandidateReminderEmail } from "@/lib/email";
import { DocumentRecord } from "@/models/Document";

const MONGO_ID_RE = /^[a-fA-F0-9]{24}$/;

export async function POST(request: Request) {
  try {
    const { documentId, senderEmail } = await request.json();
    const cleanSender = String(senderEmail || "").trim().toLowerCase();

    if (!MONGO_ID_RE.test(String(documentId || "")) || !cleanSender) {
      return NextResponse.json(
        { success: false, message: "Document and sender are required" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const doc = await DocumentRecord.findById(documentId);

    if (!doc) {
      return NextResponse.json(
        { success: false, message: "Document not found" },
        { status: 404 }
      );
    }
    if (doc.senderEmail.toLowerCase() !== cleanSender) {
      return NextResponse.json(
        { success: false, message: "Only the document sender can send a reminder" },
        { status: 403 }
      );
    }
    if (doc.status !== "Pending Sign" || !doc.recipientEmail) {
      return NextResponse.json(
        { success: false, message: "Only pending documents can be reminded" },
        { status: 409 }
      );
    }

    const result = await sendCandidateReminderEmail({
      senderEmail: doc.senderEmail,
      recipientEmail: doc.recipientEmail,
      recipientName: doc.recipientName,
      docName: doc.name,
      docId: doc._id.toString(),
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message || "Reminder email failed" },
        { status: 502 }
      );
    }

    const now = new Date();
    doc.lastReminderAt = now;
    doc.reminderCount = (doc.reminderCount || 0) + 1;
    await doc.save();

    return NextResponse.json({
      success: true,
      message: `Reminder sent to ${doc.recipientEmail}`,
      lastReminderAt: now.toISOString(),
      reminderCount: doc.reminderCount,
    });
  } catch (error: unknown) {
    console.error("Manual reminder error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Could not send reminder",
      },
      { status: 500 }
    );
  }
}
