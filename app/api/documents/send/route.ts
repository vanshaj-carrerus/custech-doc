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
    const existing = await DocumentRecord.findById(documentId);

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

    if (!existing.fileUrl) {
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
    await existing.save();

    const docId = existing._id.toString();
    const emailResult = await sendCandidateAgreementEmail({
      senderEmail: cleanSender,
      recipientEmail: cleanRecipient,
      recipientName: existing.recipientName,
      docName: existing.name,
      docId,
      subject: subject || `Signature Requested: ${existing.name}`,
      message: message || "",
    });

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
