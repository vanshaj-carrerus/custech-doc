import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { sendCandidateAgreementEmail } from "@/lib/email";
import { isMongoId } from "@/lib/mongoId";
import { DocumentRecord } from "@/models/Document";

function isAlreadySent(doc: { recipientEmail?: string; status?: string } | null) {
  if (!doc) return false;
  if (doc.status === "Pending Sign" || doc.status === "Completed") return true;
  return !!doc.recipientEmail;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      documentId,
      name,
      size,
      pages,
      senderEmail,
      recipientEmail,
      recipientName,
      subject,
      message,
      placedFields,
      fileType,
    } = body;

    const cleanSender = String(senderEmail || "").trim().toLowerCase();
    const cleanRecipient = String(recipientEmail || "").trim().toLowerCase();

    if (!cleanSender || !cleanRecipient) {
      return NextResponse.json(
        { success: false, message: "Sender and recipient email addresses are required" },
        { status: 400 }
      );
    }

    if (!isMongoId(documentId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Document is not ready to send. Upload it again, then send.",
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    // Never load fileUrl here — it's the base64 PDF (can be many MB) and this
    // route only needs to know it exists, not its content. Loading it drags
    // the whole file over the network to the app and back on save, which was
    // the main source of latency on this route (mirrors the fix already
    // applied in draft/route.ts and list/route.ts).
    const existing = await DocumentRecord.findById(documentId).select(
      "name size pages fileType senderEmail recipientEmail recipientName subject message placedFields status"
    );

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Document not found. Upload it again, then send." },
        { status: 404 }
      );
    }

    if (isAlreadySent(existing) && existing.recipientEmail !== cleanRecipient) {
      return NextResponse.json(
        {
          success: false,
          alreadySent: true,
          recipientEmail: existing.recipientEmail,
          recipientName: existing.recipientName,
          message:
            "This document was already sent. Upload a new document to send it to someone else.",
        },
        { status: 409 }
      );
    }

    const hasFile = !!(await DocumentRecord.exists({
      _id: documentId,
      fileUrl: { $exists: true, $nin: [null, ""] },
    }));
    if (!hasFile) {
      return NextResponse.json(
        {
          success: false,
          message: "The document file is still uploading. Wait a moment, then send again.",
        },
        { status: 409 }
      );
    }

    existing.name = name || existing.name;
    existing.size = size || existing.size;
    existing.pages = pages || existing.pages;
    existing.fileType = fileType || existing.fileType;
    existing.senderEmail = cleanSender;
    existing.recipientEmail = cleanRecipient;
    existing.recipientName = recipientName || cleanRecipient;
    existing.subject = subject || existing.subject || "Signature Requested";
    existing.message = message || existing.message || "";
    existing.placedFields = placedFields || existing.placedFields || [];
    existing.status = "Pending Sign";
    existing.sentAt = new Date();

    const docId = existing._id.toString();
    // Save and email don't depend on each other — run them together instead
    // of back-to-back so the slower of the two determines total time, not the sum.
    const [, emailResult] = await Promise.all([
      existing.save(),
      sendCandidateAgreementEmail({
        senderEmail: cleanSender,
        recipientEmail: cleanRecipient,
        recipientName: existing.recipientName,
        docName: existing.name,
        docId,
        subject: subject || `Signature Requested: ${existing.name}`,
        message: message || "",
      }),
    ]);

    if (!emailResult.success) {
      return NextResponse.json(
        { success: false, message: emailResult.message || "Could not send the email" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Document created & invitation email dispatched",
      signingUrl: emailResult.signingUrl,
      document: {
        id: docId,
        name: existing.name,
        senderEmail: cleanSender,
        recipientEmail: cleanRecipient,
        recipientName: existing.recipientName,
        status: "Pending Sign",
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error("Send Document error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not send this document. Please try again.",
      },
      { status: 500 }
    );
  }
}
