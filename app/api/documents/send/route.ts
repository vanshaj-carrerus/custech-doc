import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DocumentRecord } from "@/models/Document";
import { sendCandidateAgreementEmail } from "@/lib/email";

const MONGO_ID_RE = /^[a-fA-F0-9]{24}$/;

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
      fileUrl,
      fileType,
    } = body;

    if (!senderEmail || !recipientEmail) {
      return NextResponse.json(
        { success: false, message: "Sender and recipient email addresses are required" },
        { status: 400 }
      );
    }

    if (!fileUrl || typeof fileUrl !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "The document file is missing. Upload the file again, then send it.",
        },
        { status: 400 }
      );
    }

    let docRecord: any = null;

    try {
      await connectToDatabase();

      if (documentId && MONGO_ID_RE.test(String(documentId))) {
        const existing = await DocumentRecord.findById(documentId);
        if (existing && isAlreadySent(existing)) {
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
        if (existing) {
          existing.name = name || existing.name;
          existing.size = size || existing.size;
          existing.pages = pages || existing.pages;
          existing.fileUrl = fileUrl || existing.fileUrl;
          existing.fileType = fileType || existing.fileType;
          existing.senderEmail = senderEmail.toLowerCase();
          existing.recipientEmail = recipientEmail.toLowerCase();
          existing.recipientName = recipientName || recipientEmail;
          existing.subject = subject || existing.subject || "Signature Requested";
          existing.message = message || existing.message || "";
          existing.placedFields = placedFields || existing.placedFields || [];
          existing.status = "Pending Sign";
          existing.sentAt = new Date();
          await existing.save();
          docRecord = existing;
        }
      }

      if (!docRecord) {
        docRecord = await DocumentRecord.create({
          name: name || "Document.pdf",
          size: size || "1.2 MB",
          pages: pages || 1,
          fileUrl: fileUrl,
          fileType: fileType,
          senderEmail: senderEmail.toLowerCase(),
          recipientEmail: recipientEmail.toLowerCase(),
          recipientName: recipientName || recipientEmail,
          subject: subject || "Signature Requested",
          message: message || "",
          placedFields: placedFields || [],
          status: "Pending Sign",
          sentAt: new Date(),
        });
      }
    } catch (dbErr) {
      console.error("[MongoDB] Could not save document before send:", dbErr);
      return NextResponse.json(
        {
          success: false,
          message:
            "Could not save this document. The file may be too large. Try sending again or use a smaller PDF.",
        },
        { status: 500 }
      );
    }

    if (!docRecord?._id) {
      return NextResponse.json(
        { success: false, message: "Document was not saved. Please try sending again." },
        { status: 500 }
      );
    }

    const docId = docRecord._id.toString();
    const finalDocName = docRecord?.name || name || "Document.pdf";
    const finalSender = docRecord?.senderEmail || senderEmail.toLowerCase();
    const finalRecipient = docRecord?.recipientEmail || recipientEmail.toLowerCase();

    const originHeader = request.headers.get("origin");
    const hostHeader = request.headers.get("host");
    const requestBaseUrl = originHeader
      ? originHeader
      : hostHeader
      ? `${hostHeader.includes("localhost") ? "http" : "https"}://${hostHeader}`
      : process.env.NEXT_PUBLIC_APP_URL || "https://cus-doc.vercel.app";

    const emailResult = await sendCandidateAgreementEmail({
      senderEmail: finalSender,
      recipientEmail: finalRecipient,
      recipientName: recipientName || finalRecipient,
      docName: finalDocName,
      docId: docId,
      subject: subject || `Signature Requested: ${finalDocName}`,
      message: message || "",
      baseUrl: requestBaseUrl,
    });

    return NextResponse.json({
      success: true,
      message: "Document created & invitation email dispatched",
      signingUrl: emailResult.signingUrl,
      document: {
        id: docId,
        name: finalDocName,
        senderEmail: finalSender,
        recipientEmail: finalRecipient,
        recipientName: recipientName || finalRecipient,
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
